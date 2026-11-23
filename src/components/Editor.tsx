"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { editorExtensions } from "@/lib/extensions";
import { useCallback, useEffect, useRef, useState } from "react";
import ShareDialog from "./ShareDialog";
import Toolbar from "./Toolbar";
import type { Access } from "@/lib/access";

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

interface Props {
  docId: string;
  initialTitle: string;
  initialContent: object;
  access: Access;
  ownerName: string;
  shareSuggestions: string[];
}

const AUTOSAVE_MS = 800;

export default function Editor({ docId, initialTitle, initialContent, access, ownerName, shareSuggestions }: Props) {
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => setSharing(false), []);
  const readOnly = access === "view";
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const latest = useRef<object>(initialContent);

  const patch = useCallback(
    async (body: object, keepalive = false) => {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
    },
    [docId]
  );

  const flush = useCallback(
    async (keepalive = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (!dirty.current) return;
      dirty.current = false;
      setSave({ kind: "saving" });
      try {
        await patch({ content: latest.current }, keepalive);
        // If more edits arrived while saving, the next debounce will save them.
        setSave(dirty.current ? { kind: "saving" } : { kind: "saved" });
      } catch (e) {
        dirty.current = true; // retry on next change
        setSave({ kind: "error", message: e instanceof Error ? e.message : "unknown error" });
      }
    },
    [patch]
  );

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

  // Flush pending edits on tab close and on unmount.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
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
    save.kind === "saving" ? "Saving…" : save.kind === "saved" ? "Saved" : save.kind === "error" ? `Save failed: ${save.message}` : "";

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-3 flex items-center gap-3">
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
          className="flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold hover:border-gray-300 focus:border-blue-500 focus:outline-none disabled:text-black"
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
