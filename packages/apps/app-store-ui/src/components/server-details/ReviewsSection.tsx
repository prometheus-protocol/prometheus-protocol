import { MessageSquare } from 'lucide-react';

// Define a type for reviews
interface Review {
  // ... review properties
}

interface ReviewsSectionProps {
  reviews: Review[];
}

export function ReviewsSection({ reviews }: ReviewsSectionProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight mb-6">
        Ratings & reviews
      </h2>
      <div className="border border-border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
        {reviews.length === 0 ? (
          <>
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No Reviews Yet</h3>
            <p className="text-sm text-muted-foreground">
              Be the first to share your experience.
            </p>
          </>
        ) : (
          <div>{/* Logic to display reviews would go here */}</div>
        )}
      </div>
    </section>
  );
}
