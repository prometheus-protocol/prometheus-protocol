import { Rocket, TerminalSquare, BarChart3 } from 'lucide-react';

// A helper to format large numbers (including BigInts) into compact strings like "1.5K", "10M"
const formatNumber = (num: number | bigint): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(num);
  } catch (e) {
    return num.toString();
  }
};

// Format a timestamp in nanoseconds (bigint) as a short relative "launched" label.
// Examples: "Today", "3d ago", "5w ago", "8mo ago", "2y ago".
const formatLaunched = (launchedNs: bigint): string => {
  const nowMs = Date.now();
  // Convert ns -> ms safely (bigint math, then to Number for the diff).
  const launchedMs = Number(launchedNs / 1_000_000n);
  const diffMs = Math.max(0, nowMs - launchedMs);

  const day = 1000 * 60 * 60 * 24;
  const days = Math.floor(diffMs / day);

  if (days <= 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? '1w ago' : `${weeks}w ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1mo ago' : `${months}mo ago`;

  const years = Math.floor(days / 365);
  return years === 1 ? '1y ago' : `${years}y ago`;
};

// The StatItem component. `value` is optional so callers can show icon+label only.
const StatItem = ({
  value,
  label,
  Icon,
}: {
  value?: string;
  label: string;
  Icon: React.ElementType;
}) => (
  <div className="flex flex-col items-center text-center px-2">
    <div className="flex items-center gap-2 mb-1 min-h-6">
      {value && <span className="text-md font-semibold">{value}</span>}
      <Icon className="w-4 h-4" />
    </div>

    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  </div>
);

interface StatsStripProps {
  // Earliest `created` timestamp across all versions, in nanoseconds since epoch.
  // Used to show "Launched" relative time — replaces the old Users metric which
  // was noisy and unflattering for newly-listed apps.
  launchedAtNs?: bigint;
  totalTools: bigint;
  totalInvocations: bigint;
}

export function StatsStrip({
  launchedAtNs,
  totalTools,
  totalInvocations,
}: StatsStripProps) {
  return (
    <div className="mt-6 mb-6 flex items-center py-4 md:gap-x-4 gap-x-1 max-w-md">
      {launchedAtNs !== undefined && launchedAtNs > 0n && (
        <>
          <StatItem
            value={formatLaunched(launchedAtNs)}
            label="Launched"
            Icon={Rocket}
          />
          <div className="h-10 w-px bg-border" />
        </>
      )}
      <StatItem
        value={formatNumber(totalInvocations)}
        label="Total Invocations"
        Icon={BarChart3}
      />
      <div className="h-10 w-px bg-border" />
      <StatItem
        value={formatNumber(totalTools)}
        label="Available Tools"
        Icon={TerminalSquare}
      />
    </div>
  );
}
