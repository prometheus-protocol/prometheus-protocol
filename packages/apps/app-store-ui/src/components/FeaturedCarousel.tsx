import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { FeaturedServerCard } from './FeaturedServerCard';
import Autoplay from 'embla-carousel-autoplay';
import { AppStoreListing } from '@prometheus-protocol/ic-js';

interface FeaturedCarouselProps {
  servers: AppStoreListing[];
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
            key={server.namespace}
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
