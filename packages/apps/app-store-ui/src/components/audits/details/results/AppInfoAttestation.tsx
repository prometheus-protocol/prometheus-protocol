import { Section } from '@/components/Section';
import { AppInfoAttestationData } from '@prometheus-protocol/ic-js';
import { truncatePrincipal } from '@/lib/utils';
import { FileText, ExternalLink } from 'lucide-react';
import { ReactNode } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';

// A small helper for consistent text blocks
const InfoBlock = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <div className="text-gray-300 prose prose-invert max-w-none">
      {children}
    </div>
  </div>
);

// A small helper for the details panel
const DetailItem = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div>
    <p className="text-sm text-gray-400">{label}</p>
    <p className="font-medium text-white">{children}</p>
  </div>
);

export const AppInfoAttestation = ({
  data,
}: {
  data: AppInfoAttestationData;
}) => {
  return (
    <Section
      title="App Information"
      icon={<FileText className="text-primary" />}>
      <div className="space-y-12">
        {/* --- Banner Image --- */}
        {data.banner_url && (
          <ImageWithFallback
            src={data.banner_url}
            alt={`${data.name} Banner`}
            className="w-full h-auto rounded-lg object-cover"
          />
        )}
        {data.icon_url && (
          <ImageWithFallback
            src={data.icon_url}
            alt={`${data.name} Icon`}
            className="w-16 h-16 rounded-lg object-cover"
          />
        )}

        {/* --- Main Content Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Left Column: Descriptions and Features */}
          <div className="md:col-span-2 space-y-8">
            <InfoBlock title="Description">
              <p>{data.description}</p>
            </InfoBlock>

            <InfoBlock title="Why This App?">
              <p>{data.why_this_app}</p>
            </InfoBlock>

            <InfoBlock title="Key Features">
              <ul className="list-disc list-inside">
                {data.key_features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </InfoBlock>
          </div>

          {/* Right Column: Metadata and Tags */}
          <div className="md:col-span-1 space-y-6">
            <div className="border border-gray-700 rounded-lg p-4 space-y-4">
              <DetailItem label="Publisher">{data.publisher}</DetailItem>
              <DetailItem label="Category">{data.category}</DetailItem>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- Gallery Section --- */}
        {data.gallery_images && data.gallery_images.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Gallery</h3>
            <Carousel
              opts={{
                align: 'start',
                loop: true,
              }}
              className="w-full">
              <CarouselContent className="-ml-4">
                {data.gallery_images.map((imgUrl, index) => (
                  <CarouselItem key={index} className="pl-4">
                    <div className="p-1">
                      <a
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer">
                        <ImageWithFallback
                          src={imgUrl}
                          alt={`Gallery image ${index + 1}`}
                          className="w-full rounded-lg object-cover aspect-[16/10] transition-opacity hover:opacity-90"
                        />
                      </a>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden md:flex" />
              <CarouselNext className="hidden md:flex" />
            </Carousel>
          </div>
        )}
      </div>
    </Section>
  );
};
