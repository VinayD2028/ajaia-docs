"use client";

import { useState } from "react";

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Hard navigation drops every cached page and any open editor state of the previous user.
      window.location.reload();
    }
  }
  return (
    <button
      onClick={signOut}
      disabled={busy}
      className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
    >
      Sign out
    </button>
  );
}
