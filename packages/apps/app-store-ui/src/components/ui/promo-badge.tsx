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
        'absolute -top-1 -left-1 rounded-tl-[54px] md:rounded-tl-[46px] rounded-bl-none rounded-tr-none bg-primary py-3 px-6 pl-6 pt-5 font-bold text-neutral-800 md:px-6 md:py-3 md:text-lg',
        // Merge with any custom classes passed in as props
        className,
      )}
      style={{ borderBottomRightRadius: '54px' }}>
      {children}
    </Badge>
  );
}
