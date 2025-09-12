import { AuditBountyWithDetails } from '@prometheus-protocol/ic-js';
import { AttestationFormWrapper } from './AttestationFormWrapper';

export const SecurityAttestationForm = ({
  audit,
}: {
  audit: AuditBountyWithDetails;
}) => (
  <AttestationFormWrapper title="Submit Security Attestation">
    <p className="text-gray-400">
      Security attestation form fields will go here...
    </p>
    {/* Example: <Textarea placeholder="Summary..." /> */}
  </AttestationFormWrapper>
);
