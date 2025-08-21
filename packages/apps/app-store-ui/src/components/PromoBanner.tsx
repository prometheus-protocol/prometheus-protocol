import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { PromoBadge } from './ui/promo-badge';

interface PromoBannerProps {
  imageUrl: string;
  altText: string;
  linkTo: string;
}

export function PromoBanner({ imageUrl, altText, linkTo }: PromoBannerProps) {
  return (
    <section className="my-16">
      <div className="flex max-h-132 justify-center overflow-hidden rounded-4xl shadow-lg group relative">
        <Link to={linkTo}>
          <img
            src={imageUrl}
            alt={altText}
            className="transition-transform duration-500 ease-in-out group-hover:scale-105 w-full h-full object-cover"
          />
        </Link>
        <PromoBadge>Happening Now!</PromoBadge>
      </div>
    </section>
  );
}
