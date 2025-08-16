import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ServerTool } from '@/lib/mock-data';
import { Wrench, ChevronUp, ChevronDown } from 'lucide-react';

interface ToolsAndResourcesProps {
  tools: ServerTool[];
}

export function ToolsAndResources({ tools }: ToolsAndResourcesProps) {
  return (
    <section>
      <div className="pb-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
          <Wrench className="w-6 h-6" />
          Tools and resources
        </h2>
        <Accordion type="single" collapsible className="w-full space-y-3">
          {tools.map((tool, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="border border-border rounded-lg px-4 last:border-b">
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="flex-1 flex justify-between items-center pr-4">
                  <span className="font-mono font-semibold">{tool.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {tool.cost}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <p className="text-muted-foreground mb-4">{tool.description}</p>
                <div className="bg-background/50 border border-border/50 rounded-md p-3">
                  <h4 className="font-semibold text-sm mb-1">Parameters</h4>
                  <p className="text-xs text-muted-foreground">
                    {tool.parameters}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
