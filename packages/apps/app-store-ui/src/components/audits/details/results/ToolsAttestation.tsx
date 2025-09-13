import { Section } from '@/components/Section';
import { ToolsAttestationData } from '@prometheus-protocol/ic-js';
import { Wrench } from 'lucide-react';

export const ToolsAttestation = ({ data }: { data: ToolsAttestationData }) => (
  <Section title="Advertised Tools" icon={<Wrench className="text-primary" />}>
    <div className="space-y-4">
      {data.tools?.map((tool, i) => (
        <div key={i} className="border border-gray-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-mono text-lg text-white">{tool.name}</h3>
            <p className="font-semibold text-primary">
              {tool.cost} {tool.token}
            </p>
          </div>
          <p className="text-gray-400">{tool.description}</p>
        </div>
      ))}
    </div>
  </Section>
);
