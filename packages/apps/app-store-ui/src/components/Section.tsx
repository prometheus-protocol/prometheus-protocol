import { ReactNode } from 'react';

export const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) => (
  <div>
    <h2 className="flex items-center gap-3 text-2xl font-semibold text-white mb-8">
      {icon}
      <span>{title}</span>
    </h2>
    {children}
  </div>
);
