import {
  FileCode,
  Info,
  Shield,
  Wrench,
  HelpCircle,
  LucideIcon,
  BookLock,
} from 'lucide-react';

interface AuditTypeInfo {
  title: string;
  description: string;
  Icon: LucideIcon;
}

// This object maps the on-chain audit type string to its display properties.
const auditTypeMap: Record<string, AuditTypeInfo> = {
  build_reproducibility_v1: {
    title: 'Build Reproducibility',
    description:
      'Verifies that the deployed canister was built from the claimed source code.',
    Icon: FileCode,
  },
  app_info_v1: {
    title: 'App Information',
    description:
      "Confirms the accuracy of the app's name, description, and publisher details.",
    Icon: Info,
  },
  tools_v1: {
    title: 'MCP Compatibility',
    description:
      'Verifies that the application is compatible with the Model Context Protocol (MCP).',
    Icon: Wrench,
  },
  data_safety_v1: {
    title: 'Data Safety',
    description:
      'Assesses how the application collects, uses, and shares user data.',
    Icon: BookLock,
  },
};

// The default info to return if an unknown audit type is provided.
const defaultAuditInfo: AuditTypeInfo = {
  title: 'Unknown Audit',
  description: 'This is an unrecognized audit type.',
  Icon: HelpCircle,
};

/**
 * A helper function to get user-friendly display information for a given audit type.
 * @param auditType The raw audit type string from the canister (e.g., 'build_reproducibility_v1').
 * @returns An object with a title, description, and a Lucide Icon component.
 */
export const getAuditTypeInfo = (auditType: string): AuditTypeInfo => {
  return auditTypeMap[auditType] || defaultAuditInfo;
};
