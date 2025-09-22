import { Users, TerminalSquare, BarChart3, Globe } from 'lucide-react';

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

// --- 1. MODIFIED: The StatItem component is now more flexible. ---
// The `value` prop is optional to handle cases like "Public Access" which don't have a number.
const StatItem = ({
  value,
  label,
  Icon,
}: {
  value?: string; // Value is now optional
  label: string;
  Icon: React.ElementType;
}) => (
  <div className="flex flex-col items-center text-center px-2">
    <div className="flex items-center gap-2 mb-1 min-h-6">
      {/* Conditionally render the value only if it exists */}
      {value && <span className="text-md font-semibold">{value}</span>}
      <Icon className="w-4 h-4" />
    </div>

    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  </div>
);

// --- 2. UPDATED: The props now match the new, richer data structure from the canister. ---
interface StatsStripProps {
  authenticatedUniqueUsers: bigint;
  anonymousInvocations: bigint;
  totalTools: bigint;
  totalInvocations: bigint;
}

export function StatsStrip({
  authenticatedUniqueUsers,
  anonymousInvocations,
  totalTools,
  totalInvocations,
}: StatsStripProps) {
  // --- 3. NEW: This is the core logic to determine which user metric to display. ---
  const renderUserStat = () => {
    // Scenario 1: Public, Auth-Free Server (no authenticated users, but has anonymous activity)
    if (authenticatedUniqueUsers === 0n && anonymousInvocations > 0n) {
      return (
        <StatItem
          label="Public Access"
          Icon={Globe}
          // No `value` is passed, so only the icon and label will render.
        />
      );
    }

    // Scenario 2 & 3: Server has authenticated users OR no users at all.
    // This gracefully handles both cases by showing the number of authenticated users.
    // If there are no users of any kind, it will correctly show "0".
    return (
      <StatItem
        value={formatNumber(authenticatedUniqueUsers)}
        label="Unique Users"
        Icon={Users}
      />
    );
  };

  return (
    <div className="mt-6 mb-6 flex items-center py-4 md:gap-x-4 gap-x-1 max-w-md">
      {/* The user stat is now rendered conditionally */}
      {renderUserStat()}

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
