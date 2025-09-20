// src/components/server-details/ToolsAndResources.tsx

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ServerTool } from '@prometheus-protocol/ic-js';
import { Wrench, Zap } from 'lucide-react';
import TokenIcon from '../Token';
import { useGetToolInvocations } from '@/hooks/useLeaderboard';

// The props are now much simpler
interface ToolsAndResourcesProps {
  tools: ServerTool[];
  wasmId: string;
}

export function ToolsAndResources({ tools, wasmId }: ToolsAndResourcesProps) {
  const { data: invocationCounts } = useGetToolInvocations(wasmId);

  return (
    <section>
      <div className="pb-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
          <Wrench className="w-6 h-6" />
          Tools and Resources
        </h2>
      </div>
      <Accordion type="single" collapsible className="w-full space-y-3">
        {tools.map((tool, index) => {
          const count = invocationCounts?.get(tool.name);

          return (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-border rounded-lg px-4 last:border-b transition-colors data-[state=open]:border-primary">
              <AccordionTrigger className="group text-left hover:no-underline">
                <div className="flex-1 flex items-center">
                  <span className="font-mono font-semibold group-data-[state=open]:text-primary">
                    {tool.name}
                  </span>
                  <div className="flex items-center gap-4 ml-auto">
                    {count && count > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        <span>{count.toString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground font-mono">
                        ${tool.cost}
                      </span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <p className="text-muted-foreground">{tool.description}</p>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
