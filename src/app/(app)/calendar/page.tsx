import Link from 'next/link';
import { listCalendar, type CalEvent } from '@/modules/calendar/server/queries';

const KIND_COLOR: Record<string, string> = {
  Task: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  Request: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Schedule: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  Tournament: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Trip: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  Bootcamp: 'bg-green-500/15 text-green-600 dark:text-green-400',
};

function groupByDate(events: CalEvent[]): Array<[string, CalEvent[]]> {
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }
  return [...byDate.entries()];
}

function DayGroup({ date, items, isToday }: { date: string; items: CalEvent[]; isToday: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold text-fg">
        {date}
        {isToday && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Today</span>}
      </div>
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
  );
}

export default async function CalendarPage() {
  const events = await listCalendar();
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Today + future first (that's what a calendar is for); recent past collapsed below.
  const upcoming = groupByDate(events.filter((e) => e.date >= today));
  const past = groupByDate(events.filter((e) => e.date < today)).reverse(); // most recent first

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-fg">Calendar</h1>
      <p className="text-sm text-muted">Tournaments, schedules, trips, bootcamps & deadlines — scoped to your role.</p>

      {upcoming.length === 0 && <p className="mt-8 text-sm text-muted">Nothing coming up.</p>}

      <div className="mt-6 space-y-6">
        {upcoming.map(([date, items]) => (
          <DayGroup key={date} date={date} items={items} isToday={date === today} />
        ))}
      </div>

      {past.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-fg">
            Past events ({past.reduce((n, [, items]) => n + items.length, 0)})
          </summary>
          <div className="mt-4 space-y-6 opacity-70">
            {past.map(([date, items]) => (
              <DayGroup key={date} date={date} items={items} isToday={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
