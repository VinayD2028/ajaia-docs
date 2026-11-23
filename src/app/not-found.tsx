import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Document not found</h1>
      <p className="mb-4 text-sm text-gray-600">
        It may not exist, or you may not have access to it.
      </p>
      <Link href="/" className="text-blue-700 hover:underline">
        Back to your documents
      </Link>
    </main>
  );
}
