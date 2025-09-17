interface ReputationBarProps {
  available: number;
  total: number;
}

/**
 * A visual component to display available vs. total reputation, styled to match the design.
 */
export function ReputationBar({ available, total }: ReputationBarProps) {
  const percentage = total > 0 ? (available / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3 w-full">
      {/* The visual bar container, which grows to fill available space */}
      <div className="relative flex-grow h-2 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-primary/80 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {/* The text label, with a fixed width to ensure alignment */}
      <span className="w-14 text-right text-xs font-mono text-muted-foreground">
        {available}/{total}
      </span>
    </div>
  );
}
