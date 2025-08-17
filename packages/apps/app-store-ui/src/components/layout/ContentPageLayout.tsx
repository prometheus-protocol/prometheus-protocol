import React from 'react';

interface ContentPageLayoutProps {
  children: React.ReactNode;
}

export function ContentPageLayout({ children }: ContentPageLayoutProps) {
  return (
    <div className="container mx-auto py-16">
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
