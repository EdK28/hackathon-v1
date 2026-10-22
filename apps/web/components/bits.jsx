import { STATUS } from '@/lib/ui';

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, tone: 'bg-neutral-100' };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.tone}`}>{s.label}</span>;
}

export function Progress({ value, className = '' }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-line ${className}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${value}%` }} />
    </div>
  );
}

export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-black tracking-tight ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <rect width="24" height="24" rx="7" fill="var(--color-accent)" />
        <path d="M7 8.5h10M7 12h7M7 15.5h4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="17" cy="15.5" r="2" fill="#fff" />
      </svg>
      Clarify
    </span>
  );
}
