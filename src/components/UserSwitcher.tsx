"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  users: { id: string; name: string; email: string }[];
  currentId: string | null;
  compact?: boolean;
}

export default function UserSwitcher({ users, currentId, compact }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onChange(userId: string) {
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Could not switch user");
      return;
    }
    router.refresh();
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-2"}>
      <label htmlFor="user-switcher" className="text-sm font-medium">
        Signed in as
      </label>
      <select
        id="user-switcher"
        value={currentId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-gray-300 bg-white px-3 py-2 text-black"
      >
        <option value="" disabled>
          Select a user…
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.email})
          </option>
        ))}
      </select>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
