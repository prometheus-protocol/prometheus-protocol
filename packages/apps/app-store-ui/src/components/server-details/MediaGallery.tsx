import { ImageWithFallback } from '../ui/image-with-fallback';
// --- 1. Import the Carousel components ---
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface MediaGalleryProps {
  images: string[];
  appName: string;
}

export function MediaGallery({ images, appName }: MediaGalleryProps) {
  if (!images || images.length === 0) {
    return null;
  }

  return (
    <section>
      {/* --- 2. Replace the single image with the Carousel component --- */}
      <Carousel
        opts={{
          align: 'start',
          loop: true,
        }}
        // Autoplay is omitted for a better user experience in a gallery
        className="w-full">
        <CarouselContent className="-ml-4">
          {images.map((image, index) => (
            <CarouselItem key={image + index} className="pl-4">
              {/* Wrapping in a link allows opening the image in a new tab */}
              <a href={image} target="_blank" rel="noopener noreferrer">
                <ImageWithFallback
                  src={image}
                  alt={`Screenshot ${index + 1} of ${appName}`}
                  className="aspect-video w-full rounded-xl object-cover transition-opacity hover:opacity-90"
                />
              </a>
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* --- 3. Add responsive navigation arrows --- */}
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    </section>
  );
}
