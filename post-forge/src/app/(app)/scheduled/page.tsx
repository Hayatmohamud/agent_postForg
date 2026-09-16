import { EmptyState } from "@/components/ui";

/**
 * Placeholder for T15 (Scheduled / cron management). T15 replaces this with
 * the schedule list + create/edit form.
 */
export default function ScheduledPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Scheduled</p>
        <h1 className="text-2xl font-semibold text-gray-900">Scheduled posts</h1>
        <p className="text-sm text-gray-500">
          Placeholder route — T15 builds recurring-post schedule management here.
        </p>
      </header>
      <EmptyState title="No schedules yet" description="Set up a recurring topic to auto-generate posts." />
    </div>
  );
}
