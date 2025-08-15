import { Link } from 'react-router-dom';

interface PromoBannerProps {
  imageUrl: string;
  altText: string;
  linkTo: string;
}

export function PromoBanner({ imageUrl, altText, linkTo }: PromoBannerProps) {
  return (
    <section className="my-20">
      <div className="flex max-h-132 justify-center overflow-hidden rounded-3xl shadow-lg group">
        <Link to={linkTo}>
          <img
            src={imageUrl}
            alt={altText}
            className="transition-transform duration-500 ease-in-out group-hover:scale-105 w-full h-full object-cover"
          />
        </Link>
      </div>
    </section>
  );
}
