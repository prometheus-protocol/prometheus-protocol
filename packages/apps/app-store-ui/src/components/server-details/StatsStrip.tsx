import { Users, TerminalSquare, BarChart3 } from 'lucide-react';

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

// A small, internal component for each individual stat item
const StatItem = ({
  value,
  label,
  Icon,
}: {
  value: string;
  label: string;
  Icon: React.ElementType;
}) => (
  <div className="flex flex-col items-center text-center px-2">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-md font-semibold">{value}</span>
      <Icon className="w-4 h-4" />
    </div>

    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  </div>
);

interface StatsStripProps {
  uniqueUsers: bigint;
  totalTools: bigint;
  totalInvocations: bigint;
}

export function StatsStrip({
  uniqueUsers,
  totalTools,
  totalInvocations,
}: StatsStripProps) {
  return (
    <div className="mt-6 mb-6 flex items-center py-4 md:gap-x-4 gap-x-1 max-w-md">
      <StatItem
        value={formatNumber(uniqueUsers)}
        label="Unique Users"
        Icon={Users}
      />
      <div className="h-10 w-px bg-border" />
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
