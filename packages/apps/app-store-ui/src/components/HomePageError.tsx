import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface HomePageErrorProps {
  onRetry: () => void;
}

export const HomePageError = ({ onRetry }: HomePageErrorProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center min-h-[60vh]">
      <AlertTriangle className="w-16 h-16 text-destructive/50 mb-6" />
      <h2 className="text-2xl font-bold mb-2">Something Went Wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        We couldn't load the app store at this time. Please check your internet
        connection and try again.
      </p>
      <Button onClick={onRetry}>Try Again</Button>
    </div>
  );
};
