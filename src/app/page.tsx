import Dashboard from "@/components/Dashboard";
import Header from "@/components/Header";
import UserSwitcher from "@/components/UserSwitcher";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/documents";
import { listUsers } from "@/lib/shares";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const db = await getDb();
  const users = await listUsers(db);

  if (!user) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="mb-2 text-2xl font-semibold">Ajaia Docs</h1>
        <p className="mb-6 text-sm text-gray-600">Pick a demo user to continue. No password needed.</p>
        <UserSwitcher users={users} currentId={null} />
      </main>
    );
  }

  const { owned, shared } = await listDocuments(db, user.id);
  return (
    <>
      <Header users={users} currentId={user.id} />
      <Dashboard owned={owned} shared={shared} />
    </>
  );
}
