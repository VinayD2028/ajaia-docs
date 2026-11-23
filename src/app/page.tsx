import Dashboard from "@/components/Dashboard";
import Header from "@/components/Header";
import SignInForm from "@/components/SignInForm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  const db = await getDb();

  if (!user) return <SignInForm />;

  const { owned, shared } = await listDocuments(db, user.id);
  return (
    <>
      <Header userName={user.name} userEmail={user.email} />
      <Dashboard owned={owned} shared={shared} />
    </>
  );
}
