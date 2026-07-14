import { describe, expect, it } from 'vitest';
import { calculateSecurityTier } from '../src/utils';

describe('calculateSecurityTier', () => {
  it('does not rank BYOC or otherwise unverified builds', () => {
    expect(calculateSecurityTier(false, [])).toBe('Unranked');
    expect(calculateSecurityTier(false, ['security_audit_v1'])).toBe(
      'Unranked',
    );
  });

  it('treats reproducible build verification as the standard verified tier', () => {
    expect(calculateSecurityTier(true, [])).toBe('Silver');
    expect(calculateSecurityTier(true, ['app_info_v1'])).toBe('Silver');
    expect(calculateSecurityTier(true, ['app_info_v1', 'tools_v1'])).toBe(
      'Silver',
    );
  });

  it('promotes only verified code with a security audit to the top tier', () => {
    expect(calculateSecurityTier(true, ['security_audit_v1'])).toBe('Gold');
  });

  it('keeps the old complete-audit bundle as legacy Gold data', () => {
    expect(
      calculateSecurityTier(true, [
        'app_info_v1',
        'tools_v1',
        'data_safety_v1',
      ]),
    ).toBe('Gold');
  });
});
