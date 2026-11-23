import Link from "next/link";
import UserSwitcher from "./UserSwitcher";
import type { User } from "@/lib/db";

interface Props {
  users: User[];
  currentId: string | null;
  showBack?: boolean;
}

export default function Header({ users, currentId, showBack }: Props) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex items-center gap-4">
        {showBack && (
          <Link href="/" className="text-sm text-blue-700 hover:underline">
            ← All documents
          </Link>
        )}
        <span className="font-semibold">Ajaia Docs</span>
      </div>
      <UserSwitcher users={users} currentId={currentId} compact />
    </header>
  );
}
