"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { editorExtensions } from "@/lib/extensions";
import { useCallback, useEffect, useRef, useState } from "react";
import ShareDialog from "./ShareDialog";
import Toolbar from "./Toolbar";
import type { Access } from "@/lib/access";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string }
  | { kind: "conflict" };

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const RETRY_MS = 3000;

type DocJson = { content?: Array<{ type?: string; content?: unknown[] }> };
const isBlank = (d: DocJson) =>
  !d.content || d.content.length === 0 || (d.content.length === 1 && d.content[0].type === "paragraph" && !d.content[0].content?.length);

interface Props {
  docId: string;
  initialTitle: string;
  initialContent: object;
  initialVersion: number;
  access: Access;
  ownerName: string;
  shareSuggestions: string[];
}

const AUTOSAVE_MS = 800;

export default function Editor({ docId, initialTitle, initialContent, initialVersion, access, ownerName, shareSuggestions }: Props) {
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => setSharing(false), []);
  const readOnly = access === "view";
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const conflict = useRef(false);
  const latest = useRef<object>(initialContent);
  const version = useRef(initialVersion);
  const flushRef = useRef<() => void>(() => {});

  const patch = useCallback(
    async (body: object, keepalive = false) => {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new ApiError(data?.error ?? `HTTP ${res.status}`, res.status);
      return data as { version: number };
    },
    [docId]
  );

  const flush = useCallback(
    async (keepalive = false): Promise<void> => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (!dirty.current || conflict.current) return;
      if (saving.current) {
        timer.current = setTimeout(() => flushRef.current(), 200); // one save in flight at a time
        return;
      }
      dirty.current = false;
      saving.current = true;
      setSave({ kind: "saving" });
      try {
        const res = await patch({ content: latest.current, baseVersion: version.current }, keepalive);
        version.current = res.version;
        saving.current = false;
        // If more edits arrived while saving, the next debounce will save them.
        setSave(dirty.current ? { kind: "saving" } : { kind: "saved" });
      } catch (e) {
        saving.current = false;
        dirty.current = true; // keep the unsaved edit
        if (e instanceof ApiError && e.status === 409) {
          conflict.current = true;
          setSave({ kind: "conflict" });
          return;
        }
        setSave({ kind: "error", message: e instanceof Error ? e.message : "unknown error" });
        // Network failure or server error: retry on our own. Validation errors (4xx) wait for the next edit.
        if (!(e instanceof ApiError) || e.status >= 500) {
          timer.current = setTimeout(() => flushRef.current(), RETRY_MS);
        }
      }
    },
    [patch]
  );

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  const editor = useEditor({
    extensions: editorExtensions, // StarterKit v3 already includes Underline
    content: initialContent,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: { attributes: { class: "doc-prose min-h-[60vh] outline-none", "aria-label": "Document body" } },
    onUpdate({ editor }) {
      if (readOnly) return;
      latest.current = editor.getJSON();
      dirty.current = true;
      setSave({ kind: "saving" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
  });

  // The page may come from a stale snapshot (browser Back/Forward, another tab edited it).
  // Re-read the document and apply it unless the user has unsaved edits here.
  const syncFromServer = useCallback(async () => {
    if (!editor || dirty.current || saving.current || conflict.current) return;
    try {
      const res = await fetch(`/api/documents/${docId}`, { cache: "no-store" });
      if (!res.ok) return;
      const { document: d } = await res.json();
      if (dirty.current || saving.current || conflict.current) return; // user typed while we fetched
      const staleView = d.version !== version.current || (editor.isEmpty && !isBlank(d.content));
      if (!staleView) return;
      editor.commands.setContent(d.content, { emitUpdate: false });
      latest.current = d.content;
      version.current = d.version;
      if (document.activeElement?.getAttribute("aria-label") !== "Document title") {
        setTitle(d.title);
        setSavedTitle(d.title);
      }
    } catch {
      /* offline: keep what we have */
    }
  }, [editor, docId]);

  useEffect(() => {
    const first = setTimeout(() => void syncFromServer(), 0);
    const onShow = () => void syncFromServer();
    const onVisible = () => document.visibilityState === "visible" && void syncFromServer();
    const onOnline = () => void flush();
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(first);
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [syncFromServer, flush]);

  // Flush pending edits on tab close and on unmount.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current && !conflict.current) {
        void flush(true);
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void flush(true);
    };
  }, [flush]);

  async function commitTitle() {
    const next = title.trim();
    if (next === savedTitle) {
      setTitle(savedTitle);
      return;
    }
    if (next.length === 0 || next.length > 200) {
      setTitleError("Title must be 1-200 characters");
      setTitle(savedTitle); // revert
      return;
    }
    try {
      await patch({ title: next });
      setSavedTitle(next);
      setTitle(next);
      setTitleError(null);
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : "Could not rename");
      setTitle(savedTitle); // revert
    }
  }

  const status =
    save.kind === "saving"
      ? "Saving…"
      : save.kind === "saved"
        ? "Saved"
        : save.kind === "error"
          ? `Save failed: ${save.message}`
          : save.kind === "conflict"
            ? "Not saved: changed elsewhere"
            : "";

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          aria-label="Document title"
          value={title}
          disabled={readOnly}
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(null);
          }}
          onBlur={() => !readOnly && void commitTitle()}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold hover:border-gray-300 focus:border-blue-500 focus:outline-none disabled:text-black"
        />
        {access === "owner" && (
          <button
            onClick={() => setSharing(true)}
            className="rounded border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-50"
          >
            Share
          </button>
        )}
        {readOnly && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium">View only</span>}
        {access !== "owner" && <span className="text-xs text-gray-500">Owner: {ownerName}</span>}
        <span role="status" aria-live="polite" className={`text-xs ${save.kind === "error" ? "text-red-600" : "text-gray-500"}`}>
          {status}
        </span>
      </div>
      {save.kind === "conflict" && (
        <p role="alert" className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This document was changed in another tab or by another person, so your latest edits were not saved. Copy anything
          you need, then{" "}
          <button className="font-medium underline" onClick={() => window.location.reload()}>
            reload the latest version
          </button>
          .
        </p>
      )}
      {titleError && <p role="alert" className="mb-2 text-sm text-red-600">{titleError}</p>}

      <div className="rounded border border-gray-300 bg-white">
        {editor && !readOnly && <Toolbar editor={editor} />}
        <div className="p-6">
          <EditorContent editor={editor} />
        </div>
      </div>
      {sharing && <ShareDialog docId={docId} suggestions={shareSuggestions} onClose={closeShare} />}
    </div>
  );
}
