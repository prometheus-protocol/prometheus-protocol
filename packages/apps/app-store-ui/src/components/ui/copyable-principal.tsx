import { useState } from 'react';
import { Principal } from '@icp-sdk/core/principal';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyablePrincipalProps {
  principal: Principal;
  className?: string;
}

export function CopyablePrincipal({
  principal,
  className,
}: CopyablePrincipalProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(principal.toText());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy principal: ', err);
      // Optionally, show an error state to the user
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between w-full p-2 border rounded-md bg-muted text-muted-foreground',
        className,
      )}>
      <p className="font-mono text-sm truncate">{principal.toText()}</p>
      <Button
        onClick={handleCopy}
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Copy principal to clipboard">
        {isCopied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
