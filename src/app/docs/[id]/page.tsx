import { notFound, redirect } from "next/navigation";
import Editor from "@/components/Editor";
import Header from "@/components/Header";
import { getAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getDb, type User } from "@/lib/db";
import { getDocument } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const db = getDb();
  const access = getAccess(db, id, user.id);
  if (!access) notFound();
  const doc = getDocument(db, id)!;
  const users = db.prepare("SELECT id, name, email FROM users ORDER BY name").all() as User[];

  return (
    <>
      <Header users={users} currentId={user.id} showBack />
      <Editor
        docId={doc.id}
        initialTitle={doc.title}
        initialContent={JSON.parse(doc.content_json)}
        access={access}
        ownerName={doc.owner_name}
        shareSuggestions={users.filter((u) => u.id !== user.id).map((u) => u.email)}
      />
    </>
  );
}
