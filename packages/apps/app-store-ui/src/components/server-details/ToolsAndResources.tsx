import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ServerTool } from '@prometheus-protocol/ic-js';
import { Wrench } from 'lucide-react'; // We'll reuse the Wrench icon for the empty state
import Token from '../Token';

interface ToolsAndResourcesProps {
  tools: ServerTool[];
}

export function ToolsAndResources({ tools }: ToolsAndResourcesProps) {
  const hasTools = tools && tools.length > 0;

  return (
    <section>
      <div className="pb-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
          <Wrench className="w-6 h-6" />
          Tools and resources
        </h2>

        {hasTools ? (
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
                      <Token className="h-5" />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <p className="text-muted-foreground">{tool.description}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          // --- THIS IS THE NEW, MATCHING EMPTY STATE ---
          <div className="border border-border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
            <Wrench className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No Tools Defined</h3>
            <p className="text-sm text-muted-foreground">
              This app has not registered any tools or resources.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
