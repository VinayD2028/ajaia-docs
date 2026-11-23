"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "Could not sign in");
        setPassword("");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-sm p-6 pt-16">
      <h1 className="mb-1 text-2xl font-semibold">Ajaia Docs</h1>
      <p className="mb-6 text-sm text-gray-600">Sign in to see your documents.</p>
      <form onSubmit={submit} method="post" className="flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="signin-email">Email</label>
        <input
          id="signin-email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <label className="text-sm font-medium" htmlFor="signin-password">Password</label>
        <input
          id="signin-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <p className="mb-1 font-medium">Demo accounts</p>
        <p>alice@example.com, bob@example.com, carol@example.com</p>
        <p>
          Password for all three: <code className="rounded bg-white px-1">ajaia-demo</code>
        </p>
      </div>
    </main>
  );
}
