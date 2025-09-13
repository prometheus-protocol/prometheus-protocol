import { Section } from '@/components/Section';
import { FileText } from 'lucide-react';
import { ReactNode } from 'react';

export const AttestationFormWrapper = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Section title={title} icon={<FileText className="text-primary" />}>
    <div className="border border-gray-600 rounded-lg p-6 space-y-6">
      {children}
    </div>
  </Section>
);
