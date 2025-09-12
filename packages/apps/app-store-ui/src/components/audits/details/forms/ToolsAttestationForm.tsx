import { AuditBountyWithDetails } from '@prometheus-protocol/ic-js';
import { AttestationFormWrapper } from './AttestationFormWrapper';

export const ToolsAttestationForm = ({
  audit,
}: {
  audit: AuditBountyWithDetails;
}) => (
  <AttestationFormWrapper title="Submit Tools Attestation">
    <p className="text-gray-400">
      Tools attestation form fields will go here...
    </p>
    {/* Example: Inputs for tool name, cost, token, etc. */}
  </AttestationFormWrapper>
);
