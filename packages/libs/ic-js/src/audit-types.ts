/**
 * Audit type configuration for the Prometheus Protocol.
 * These define the different types of audits that verifiers can perform.
 */

/**
 * Available audit types in the system.
 * Each audit type requires a separate stake and represents a different verification specialization.
 */
export const AUDIT_TYPES = {
  BUILD_REPRODUCIBILITY_V1: 'build_reproducibility_v1',
  TOOLS_V1: 'tools_v1',
  // Coming soon:
  // APP_INFO_V1: 'app_info_v1',
  // DATA_SECURITY_V1: 'data_security_v1',
} as const;

/**
 * Type-safe audit type values.
 */
export type AuditType = (typeof AUDIT_TYPES)[keyof typeof AUDIT_TYPES];

/**
 * Human-readable labels for audit types.
 */
export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  [AUDIT_TYPES.BUILD_REPRODUCIBILITY_V1]: 'Build Reproducibility',
  [AUDIT_TYPES.TOOLS_V1]: 'MCP Compatibility',
};

/**
 * Descriptions for audit types.
 */
export const AUDIT_TYPE_DESCRIPTIONS: Record<AuditType, string> = {
  [AUDIT_TYPES.BUILD_REPRODUCIBILITY_V1]:
    'Verify that builds are reproducible and match the claimed source code',
  [AUDIT_TYPES.TOOLS_V1]:
    'Audit development tools and CLI applications for security and functionality',
};

/**
 * Get all available audit types as an array.
 */
export function getAllAuditTypes(): AuditType[] {
  return Object.values(AUDIT_TYPES);
}

/**
 * Get the label for an audit type.
 */
export function getAuditTypeLabel(auditType: AuditType): string {
  return AUDIT_TYPE_LABELS[auditType] || auditType;
}

/**
 * Get the description for an audit type.
 */
export function getAuditTypeDescription(auditType: AuditType): string {
  return AUDIT_TYPE_DESCRIPTIONS[auditType] || '';
}
