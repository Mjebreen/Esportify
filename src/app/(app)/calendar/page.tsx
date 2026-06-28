import Link from 'next/link';
import { listCalendar } from '@/modules/calendar/server/queries';

const KIND_COLOR: Record<string, string> = {
  Task: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  Request: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Schedule: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  Tournament: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Trip: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Bootcamp: 'bg-green-500/15 text-green-600 dark:text-green-400',
};

export default async function CalendarPage() {
  const events = await listCalendar();
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-fg">Calendar</h1>
      <p className="text-sm text-muted">Tournaments, schedules, trips, bootcamps & deadlines — scoped to your role.</p>

      {byDate.size === 0 && <p className="mt-8 text-sm text-muted">Nothing scheduled.</p>}

      <div className="mt-6 space-y-6">
        {[...byDate.entries()].map(([date, items]) => (
          <div key={date}>
            <div className="text-sm font-semibold text-fg">{date}</div>
            <ul className="mt-2 space-y-2">
              {items.map((e, i) => (
                <li key={`${e.href}-${i}`} className="flex items-center gap-3 rounded-lg border bg-surface p-3 text-sm">
                  <span className={`rounded px-2 py-0.5 text-xs ${KIND_COLOR[e.kind] ?? 'bg-bg text-muted'}`}>{e.kind}</span>
                  <Link href={e.href} className="text-fg hover:underline">
                    {e.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
