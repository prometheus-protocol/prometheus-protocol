import { cn } from '@/lib/utils';

export default function Token({ className }: { className?: string }) {
  return (
    <img
      src="/images/usdc.svg"
      alt="USDC Token"
      className={cn('h-8 inline-block', className)}
    />
  );
}
