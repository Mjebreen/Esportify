export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  success: 'bg-green-500/15 text-green-600 dark:text-green-400',
  warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  danger: 'bg-red-500/15 text-red-600 dark:text-red-400',
  info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  accent: 'bg-accent/15 text-accent',
};

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const SUCCESS = ['ACTIVE', 'DONE', 'PAID', 'READY', 'COMPLETED', 'BOOKED'];
const INFO = ['IN_PROGRESS', 'SENT', 'ONGOING', 'UPCOMING', 'TRIAL'];
const WARNING = ['HIGH', 'BENCHED', 'DRAFT', 'PENDING'];
const DANGER = ['BLOCKED', 'OVERDUE', 'SUSPENDED', 'CANCELLED', 'TERMINATED', 'EXPIRED', 'URGENT', 'VOID', 'FORMER', 'ABSENCE'];

/** Map a status/priority string to a badge tone. */
export function statusTone(value: string): Tone {
  const v = value.toUpperCase();
  if (SUCCESS.includes(v)) return 'success';
  if (INFO.includes(v)) return 'info';
  if (DANGER.includes(v)) return 'danger';
  if (WARNING.includes(v)) return 'warning';
  return 'neutral';
}
