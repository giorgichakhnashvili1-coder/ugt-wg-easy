import { isIPv4 } from 'is-ip';

export type PublicIpInvalidReason = 'invalid_type' | 'invalid_ipv4';

export type PublicIpValidationResult =
  { valid: true } | { valid: false; reason: PublicIpInvalidReason };

export function validatePublicIp(value: string): PublicIpValidationResult {
  if (!isIPv4(value)) {
    return { valid: false, reason: 'invalid_ipv4' };
  }

  return { valid: true };
}
