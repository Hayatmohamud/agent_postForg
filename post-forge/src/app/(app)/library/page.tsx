import { EmptyState } from "@/components/ui";

/**
 * Placeholder for T14 (Library). The topbar search and the "no results"
 * global-search fallback both navigate here as `/library?q=...` — real
 * filtering lands with T14.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Library</p>
        <h1 className="text-2xl font-semibold text-gray-900">Your posts</h1>
        <p className="text-sm text-gray-500">
          Placeholder route — T14 builds the searchable/filterable grid. Topbar search navigates here
          with a <span className="font-mono">?q=</span> param{q ? ` (currently "${q}")` : ""}.
        </p>
      </header>
      <EmptyState title="No posts yet" description="Posts you generate will show up here." />
    </div>
  );
}
