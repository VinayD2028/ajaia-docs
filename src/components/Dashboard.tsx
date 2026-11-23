"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { DocSummary } from "@/lib/documents";

function Row({ doc, shared }: { doc: DocSummary; shared?: boolean }) {
  return (
    <li>
      <Link
        href={`/docs/${doc.id}`}
        className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 hover:border-blue-400"
      >
        <div>
          <div className="font-medium">{doc.title}</div>
          <div className="text-xs text-gray-500">
            {shared ? `Owner: ${doc.owner_name} · ` : ""}Updated {doc.updated_at} UTC
          </div>
        </div>
        {!shared && (doc.share_count ?? 0) > 0 && (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
            Shared with {doc.share_count}
          </span>
        )}
        {shared && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              doc.permission === "edit" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
            }`}
          >
            {doc.permission === "edit" ? "Can edit" : "Can view"}
          </span>
        )}
      </Link>
    </li>
  );
}

export default function Dashboard({ owned, shared }: { owned: DocSummary[]; shared: DocSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function createDoc() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create document");
      router.push(`/docs/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create document");
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/documents/import", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Import failed (HTTP ${res.status})`);
      router.push(`/docs/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      setBusy(false);
    } finally {
      if (fileRef.current) fileRef.current.value = ""; // allow re-selecting the same file
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.docx"
          aria-label="Import file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Import file
        </button>
        <button
          onClick={createDoc}
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Working…" : "New document"}
        </button>
        </div>
      </div>
      <p className="-mt-4 mb-6 text-right text-xs text-gray-500">Import supports: .txt, .md, .docx (max 2 MB)</p>
      {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-8" aria-labelledby="owned-h">
        <h2 id="owned-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          My documents
        </h2>
        {owned.length === 0 ? (
          <p className="text-sm text-gray-500">You haven&apos;t created any documents yet.</p>
        ) : (
          <ul className="space-y-2">{owned.map((d) => <Row key={d.id} doc={d} />)}</ul>
        )}
      </section>

      <section aria-labelledby="shared-h">
        <h2 id="shared-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">
          Shared with me
        </h2>
        {shared.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing has been shared with you.</p>
        ) : (
          <ul className="space-y-2">{shared.map((d) => <Row key={d.id} doc={d} shared />)}</ul>
        )}
      </section>
    </div>
  );
}
