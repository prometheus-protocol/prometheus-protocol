import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import React from 'react';

interface PromoBadgeProps {
  /**
   * The content to display inside the badge, e.g., "Special Offer", "New!".
   */
  children: React.ReactNode;
  /**
   * Optional additional class names to apply to the badge for custom styling or positioning.
   */
  className?: string;
}

/**
 * A styled promotional badge with a unique corner shape, designed to be
 * placed absolutely within a relatively positioned parent container.
 */
export function PromoBadge({ children, className }: PromoBadgeProps) {
  return (
    <Badge
      variant={'default'}
      className={cn(
        // Base styles for the unique shape, colors, and typography
        'absolute top-0 left-0 rounded-bl-none rounded-tl-3xl rounded-tr-none rounded-br-3xl bg-primary py-2 px-4 font-bold text-neutral-800 md:px-6 md:py-3 md:text-lg',
        // Merge with any custom classes passed in as props
        className,
      )}>
      {children}
    </Badge>
  );
}
