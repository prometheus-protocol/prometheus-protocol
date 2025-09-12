import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react'; // A nice placeholder icon
import { cn } from '@/lib/utils';

interface ImageWithFallbackProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
}

export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackClassName,
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  // If the src is invalid or has thrown an error, show the fallback.
  if (hasError || !src) {
    return (
      <div
        className={`
          flex items-center justify-center bg-muted/40 text-muted-foreground 
          ${className} ${fallbackClassName}
        `}>
        <ImageIcon className="w-1/3 h-1/3 opacity-50" />
      </div>
    );
  }

  // Otherwise, render the image and attach the onError handler.
  return (
    <img
      src={src}
      alt={alt}
      className={cn(className, 'border border-grey-600')}
      onError={() => setHasError(true)} // This is the key!
      {...props}
    />
  );
}
