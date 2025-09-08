import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

/**
 * A reusable logo component that links to the homepage.
 * Includes the SVG icon and the brand name.
 * @param {string} [className] - Optional classes to apply to the container.
 */
export function Logo({ className }: LogoProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Link to="/">
        <img
          src="/logo.png"
          alt="Prometheus Protocol Logo"
          className="max-h-10 md:max-h-14"
        />
      </Link>
    </div>
  );
}
