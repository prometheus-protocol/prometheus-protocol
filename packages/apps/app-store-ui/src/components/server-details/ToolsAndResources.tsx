import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AuditBounty, ServerTool, Token } from '@prometheus-protocol/ic-js';
import { Hourglass, Wrench, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { CreateBountyDialog } from './CreateBountyDialog'; // 1. Import the new dialog
import TokenIcon from '../Token';
import { Link } from 'react-router-dom';
import { Principal } from '@dfinity/principal';
import { useGetToolInvocations } from '@/hooks/useLeaderboard';

interface ToolsAndResourcesProps {
  tools: ServerTool[];
  appId: string; // 2. Add appId prop to know which app to create the bounty for
  paymentToken: Token; // 3. Add paymentToken prop
  bounty?: AuditBounty;
  canisterId: Principal;
}

export function ToolsAndResources({
  tools,
  appId,
  paymentToken,
  bounty,
  canisterId,
}: ToolsAndResourcesProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false); // 4. Add state for the dialog
  const hasTools = tools && tools.length > 0;
  const auditType = 'tools_v1'; // This component is specific to this attestation type
  const hasBounty = !!bounty; // Check if a bounty object was passed

  const principal = canisterId;
  const { data: invocationCounts } = useGetToolInvocations(principal);

  console.log('Invocation Counts:', tools);

  const renderContent = () => {
    // 4. Implement the new 3-state logic
    if (hasTools) {
      // STATE 1: Attestation is complete. Show the results.
      return (
        <Accordion type="single" collapsible className="w-full space-y-3">
          {tools.map((tool, index) => {
            // Get the count for this specific tool from the fetched map
            const count = invocationCounts?.get(tool.name);

            return (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="
                  border border-border rounded-lg px-4 last:border-b 
                  transition-colors data-[state=open]:border-primary
                ">
                <AccordionTrigger className="group text-left hover:no-underline">
                  {/* --- THE FIX IS HERE --- */}
                  <div className="flex-1 flex items-center pr-4">
                    {/* Tool name remains on the left */}
                    <span className="font-mono font-semibold group-data-[state=open]:text-primary">
                      {tool.name}
                    </span>

                    {/* This group uses ml-auto to push itself to the far right */}
                    <div className="flex items-center gap-4 ml-auto">
                      {/* Invocation Count */}
                      {count && count > 0 && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
                          <Zap className="h-4 w-4 text-yellow-400" />
                          <span>{count.toString()}</span>
                        </div>
                      )}

                      {/* Cost */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-mono">
                          {tool.cost}
                        </span>
                        <TokenIcon className="h-5" />
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
      );
    }
    if (hasBounty) {
      // STATE 2: No attestation, but a bounty exists. Show an "Awaiting Audit" panel with a link.
      return (
        <div className="border border-border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
          <Hourglass className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold">Bounty Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {' '}
            {/* Added margin-bottom */}A bounty of{' '}
            <span className="font-bold text-foreground">
              {/* Corrected to bounty.amount based on the AuditBounty type */}
              {paymentToken.fromAtomic(bounty.tokenAmount)}{' '}
              {paymentToken.symbol}
            </span>{' '}
            has been sponsored for this audit.
          </p>
          {/* 2. Add the link and button */}
          <Link to={`/audit-hub/${bounty.id.toString()}`}>
            <Button>View Bounty</Button>
          </Link>
        </div>
      );
    }

    // STATE 3: No attestation and no bounty. Show the "Sponsor Bounty" button.
    return (
      <div className="border border-border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
        <Wrench className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold">No Tools Attestation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This app has not yet been audited for its tools and resources.
        </p>
        <Button onClick={() => setIsDialogOpen(true)}>Sponsor Bounty</Button>
      </div>
    );
  };

  return (
    <>
      <section>
        <div className="pb-6">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
            <Wrench className="w-6 h-6" />
            Tools and resources
          </h2>
          {renderContent()}
        </div>
      </section>

      <CreateBountyDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        appId={appId}
        auditType={auditType}
        paymentToken={paymentToken}
      />
    </>
  );
}
