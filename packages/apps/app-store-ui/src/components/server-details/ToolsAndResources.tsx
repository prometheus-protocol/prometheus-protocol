// src/components/server-details/ToolsAndResources.tsx

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ServerTool } from '@prometheus-protocol/ic-js';
import { BarChart3, Wrench } from 'lucide-react';
import { useNamespaceTools } from '@/hooks/useNamespaceTools';

// Props: `tools` comes from the audit-sourced tools_v1 attestation (has
// description + cost), and may be empty for BYOC / unaudited apps.
// `namespace` is used to fetch runtime-tracked tools from the usage tracker.
interface ToolsAndResourcesProps {
  tools: ServerTool[];
  namespace: string;
}

// What we render per row — merged shape from both sources.
type DisplayTool = {
  name: string;
  description?: string;
  cost?: string;
  tokenSymbol?: string;
  invocations?: bigint;
};

export function ToolsAndResources({
  tools,
  namespace,
}: ToolsAndResourcesProps) {
  const { data: namespaceTools } = useNamespaceTools(namespace);

  // Map audit-sourced tools by name for quick merging.
  const auditToolsByName = new Map<string, ServerTool>();
  tools.forEach((t) => auditToolsByName.set(t.name, t));

  // Map invocation counts by tool_id (matches tool.name at runtime).
  const invocationsByName = new Map<string, bigint>();
  namespaceTools?.forEach((t) =>
    invocationsByName.set(t.tool_id, t.total_invocations),
  );

  // Build the final list: every audit tool, plus any runtime-observed tool
  // that isn't already in the audit list (typical for BYOC).
  const displayTools: DisplayTool[] = [];
  const seen = new Set<string>();

  for (const t of tools) {
    seen.add(t.name);
    displayTools.push({
      name: t.name,
      description: t.description,
      cost: t.cost,
      tokenSymbol: t.tokenSymbol,
      invocations: invocationsByName.get(t.name),
    });
  }

  namespaceTools?.forEach((nt) => {
    if (seen.has(nt.tool_id)) return;
    displayTools.push({
      name: nt.tool_id,
      invocations: nt.total_invocations,
    });
  });

  // Nothing to show — hide the whole section rather than print an empty header.
  if (displayTools.length === 0) return null;

  return (
    <section>
      <div className="pb-6">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Wrench className="w-6 h-6" />
          Tools and Resources
        </h2>
      </div>
      <Accordion type="single" collapsible className="w-full space-y-3">
        {displayTools.map((tool, index) => {
          const count = tool.invocations;
          const hasDetails =
            !!tool.description ||
            (!!tool.cost && parseFloat(tool.cost) !== 0);

          return (
            <AccordionItem
              key={`${tool.name}-${index}`}
              value={`item-${index}`}
              className="border border-border rounded-lg px-4 last:border-b transition-colors data-[state=open]:border-primary">
              <AccordionTrigger
                className="group text-left hover:no-underline"
                // If we have no description or cost to reveal, keep the row
                // visually consistent but non-interactive-feeling.
                disabled={!hasDetails}>
                <div className="flex-1 flex items-center">
                  <span className="font-mono font-semibold group-data-[state=open]:text-primary">
                    {tool.name}
                  </span>
                  <div className="flex items-center gap-4 ml-auto">
                    {count !== undefined && count > 0n && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
                        <BarChart3 className="h-3 w-3" />
                        <span>{count.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              {hasDetails && (
                <AccordionContent className="pt-2 pb-4">
                  {tool.description && (
                    <p className="text-muted-foreground">{tool.description}</p>
                  )}

                  {tool.cost && parseFloat(tool.cost) !== 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-foreground font-mono font-semibold px-2 py-0.5 bg-accent rounded">
                        {`${tool.cost} ${tool.tokenSymbol ?? ''}`.trim()}
                      </span>
                    </div>
                  )}
                </AccordionContent>
              )}
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
