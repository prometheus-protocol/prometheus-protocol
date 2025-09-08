import { cn } from '@/lib/utils';

export default function Token({ className }: { className?: string }) {
  return (
    <img
      src="/images/pmp-token.webp"
      alt="PMP Token"
      className={cn('h-8 inline-block', className)}
    />
  );
}
