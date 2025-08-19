import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { FeaturedServer } from '@/lib/mock-data';
import { FeaturedServerCard } from './FeaturedServerCard';
import Autoplay from 'embla-carousel-autoplay';

interface FeaturedCarouselProps {
  servers: FeaturedServer[];
}

export function FeaturedCarousel({ servers }: FeaturedCarouselProps) {
  return (
    <Carousel
      opts={{
        align: 'start',
        loop: true,
      }}
      plugins={[
        Autoplay({
          delay: 3000,
        }),
      ]}
      className="w-full">
      <CarouselContent className="-ml-12">
        {servers.map((server) => (
          <CarouselItem
            key={server.id}
            className="md:basis-1/2 lg:basis-1/3 pl-12">
            <FeaturedServerCard server={server} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden md:flex" />
      <CarouselNext className="hidden md:flex" />
    </Carousel>
  );
}
