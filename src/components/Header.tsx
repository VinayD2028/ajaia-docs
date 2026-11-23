import Link from "next/link";
import SignOutButton from "./SignOutButton";

interface Props {
  userName: string;
  userEmail: string;
  showBack?: boolean;
}

export default function Header({ userName, userEmail, showBack }: Props) {
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
      <div className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 truncate text-sm text-gray-700" title={userEmail}>
          <span className="hidden sm:inline">Signed in as </span>
          <strong>{userName}</strong>
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
