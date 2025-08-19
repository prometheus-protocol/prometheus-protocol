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
              className="
                border border-border rounded-lg px-4 last:border-b 
                transition-colors data-[state=open]:border-primary
              ">
              <AccordionTrigger className="group text-left hover:no-underline">
                <div className="flex-1 flex justify-between items-center pr-4">
                  <span className="font-mono font-semibold group-data-[state=open]:text-primary">
                    {tool.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground font-mono">
                      {tool.cost}
                    </span>
                    <img
                      src="/images/pmp-token.webp"
                      alt="Expand"
                      className="h-4 inline-block"
                    />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <p className="text-muted-foreground">{tool.description}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
