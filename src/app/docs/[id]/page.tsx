import { notFound, redirect } from "next/navigation";
import Editor from "@/components/Editor";
import Header from "@/components/Header";
import { getAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/documents";
import { listUsers } from "@/lib/shares";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const { id } = await params;
  const db = await getDb();
  const access = await getAccess(db, id, user.id);
  if (!access) notFound();
  const doc = (await getDocument(db, id))!;
  const users = await listUsers(db);

  return (
    <>
      <Header userName={user.name} userEmail={user.email} showBack />
      <Editor
        docId={doc.id}
        initialTitle={doc.title}
        initialContent={JSON.parse(doc.content_json)}
        initialVersion={doc.version}
        access={access}
        ownerName={doc.owner_name}
        shareSuggestions={users.filter((u) => u.id !== user.id).map((u) => u.email)}
      />
    </>
  );
}
