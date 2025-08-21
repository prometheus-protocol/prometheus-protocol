export default function NotFoundPage() {
  return (
    // This container will center the content vertically and horizontally
    // within the available space of the <main> layout area.
    <div className="flex flex-col items-center justify-center py-20">
      {/* This flex container holds the "404 | Message" part */}
      <div className="flex items-center gap-4">
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          404
        </h1>

        {/* The vertical divider line */}
        <div className="h-12 border-l border-foreground/50" />

        <div className="flex flex-col items-start">
          <h2 className="text-lg font-medium text-foreground">
            Page Not Found
          </h2>
          <p className="text-sm text-muted-foreground max-w-[200px] md:max-w-[300px]">
            The page you are looking for does not exist.
          </p>
        </div>
      </div>
    </div>
  );
}
