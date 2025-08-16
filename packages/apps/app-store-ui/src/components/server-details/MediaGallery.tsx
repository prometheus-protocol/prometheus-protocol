interface MediaGalleryProps {
  images: string[];
  appName: string;
}

export function MediaGallery({ images, appName }: MediaGalleryProps) {
  // In a real app, you might have a placeholder if there are no images.
  if (!images || images.length === 0) {
    return null;
  }

  // We'll feature the first image. The rest could be thumbnails.
  const featureImage = images[0];

  return (
    <section>
      {/* The overflow-hidden is crucial for containing the hover effect */}
      <div className="overflow-hidden rounded-2xl">
        <img
          src={featureImage}
          alt={`Screenshot of ${appName}`}
          className="aspect-video w-full object-cover transition-transform duration-300 ease-in-out hover:scale-105"
        />
      </div>
      {/* You could map over the rest of the images here to create thumbnails */}
    </section>
  );
}
