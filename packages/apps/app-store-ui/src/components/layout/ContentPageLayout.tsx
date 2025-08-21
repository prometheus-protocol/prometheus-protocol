import React from 'react';
import { Link } from 'react-router-dom';

interface ContentPageLayoutProps {
  children: React.ReactNode;
}

export function ContentPageLayout({ children }: ContentPageLayoutProps) {
  return (
    <div className="container mx-auto py-16 max-w-4xl">
      {/* Back button */}
      <div className="mb-8">
        <Link
          to="/"
          className="text-primary text-sm hover:text-primary/90 transition-colors">
          &larr; Back to App Store
        </Link>
      </div>
      <article
        className="
          prose 
          prose-invert 
          max-w-4xl 
          mx-auto
          prose-headings:text-foreground
          prose-a:text-primary
          hover:prose-a:text-primary/90
        ">
        {children}
      </article>
    </div>
  );
}
