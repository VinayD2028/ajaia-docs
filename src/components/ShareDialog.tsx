"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ShareRow } from "@/lib/shares";

interface Props {
  docId: string;
  suggestions: string[]; // other seeded users' emails
  onClose: () => void;
}

export default function ShareDialog({ docId, suggestions, onClose }: Props) {
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit">("edit");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef(0);
  const downOnBackdrop = useRef(false);
  const base = `/api/documents/${docId}/shares`;

  const call = useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data as { shares: ShareRow[] };
  }, []);

  // Remember what had focus (the Share button) and give it back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    openedAt.current = Date.now();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    call(base)
      .then((d) => setShares(d.shares))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [base, call, onClose]);

  async function run(fn: () => Promise<{ shares: ShareRow[] }>, success?: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      setShares((await fn()).shares);
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    }
  }

  // Keep Tab / Shift+Tab inside the modal.
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const items = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>("button, input, select, [href], [tabindex]:not([tabindex='-1'])")
    ).filter((el) => !(el as HTMLButtonElement).disabled);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    void run(
      () => call(base, { method: "POST", body: JSON.stringify({ email, permission }) }),
      `Shared with ${email.trim()}`
    ).then((ok) => ok && setEmail("")); // keep the typed address on failure so it can be corrected
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Close only on a deliberate click that started AND ended on the backdrop. Ignore the first
        // moments, so the second click of a double-click on "Share" doesn't dismiss the dialog.
        if (e.target === e.currentTarget && downOnBackdrop.current && Date.now() - openedAt.current > 500) onClose();
        downOnBackdrop.current = false;
      }}
      onKeyDown={trapTab}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="share-title" className="w-full max-w-md rounded bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-title" className="text-lg font-semibold">Share document</h2>
          <button onClick={onClose} aria-label="Close" className="rounded px-2 text-xl leading-none hover:bg-gray-100">×</button>
        </div>

        <form onSubmit={add} className="mb-3 flex gap-2">
          <input
            ref={inputRef}
            type="email"
            required
            list="share-suggestions"
            placeholder="Add person by email"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <datalist id="share-suggestions">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
          <select
            aria-label="Permission for new person"
            value={permission}
            onChange={(e) => setPermission(e.target.value as "view" | "edit")}
            className="rounded border border-gray-300 px-2 text-sm"
          >
            <option value="edit">Can edit</option>
            <option value="view">Can view</option>
          </select>
          <button type="submit" className="rounded bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">Add</button>
        </form>

        {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
        {notice && <p role="status" className="mb-2 text-sm text-green-700">{notice}</p>}

        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600">People with access</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : shares.length === 0 ? (
          <p className="text-sm text-gray-500">Only you can access this document.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shares.map((s) => (
              <li key={s.user_id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="truncate text-xs text-gray-500">{s.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Permission for ${s.name}`}
                    value={s.permission}
                    onChange={(e) =>
                      void run(() => call(`${base}/${s.user_id}`, { method: "PATCH", body: JSON.stringify({ permission: e.target.value }) }))
                    }
                    className="rounded border border-gray-300 px-1 py-1 text-sm"
                  >
                    <option value="edit">Can edit</option>
                    <option value="view">Can view</option>
                  </select>
                  <button
                    onClick={() => void run(() => call(`${base}/${s.user_id}`, { method: "DELETE" }), `Removed ${s.name}`)}
                    aria-label={`Remove ${s.name}`}
                    className="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
