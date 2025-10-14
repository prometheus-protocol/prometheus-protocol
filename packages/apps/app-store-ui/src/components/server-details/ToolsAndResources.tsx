// src/components/server-details/ToolsAndResources.tsx

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ServerTool } from '@prometheus-protocol/ic-js';
import { BarChart3, Wrench } from 'lucide-react';
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
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
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
                        <BarChart3 className="h-3 w-3" />
                        <span>{count.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground font-mono font-semibold px-2 py-0.5 bg-accent rounded">
                        {parseFloat(tool.cost) === 0
                          ? 'Free'
                          : `${tool.cost} ${tool.tokenSymbol}`}
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
