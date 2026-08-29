const MAX_TOTAL_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;
const LABEL_PATTERN = /^[a-z0-9-]+$/;

export type HostnameInvalidReason =
  | 'invalid_type'
  | 'empty'
  | 'too_long'
  | 'empty_label'
  | 'label_too_long'
  | 'leading_hyphen'
  | 'trailing_hyphen'
  | 'invalid_characters';

export type HostnameValidationResult =
  { valid: true } | { valid: false; reason: HostnameInvalidReason };

/**
 * validate a hostname against RFC 1123
 *
 * does not perform DNS resolution, file writes, or cert checks -
 * format validation only
 */
export function validateHostname(hostname: string): HostnameValidationResult {
  if (hostname.length === 0) {
    return { valid: false, reason: 'empty' };
  }

  if (hostname.length > MAX_TOTAL_LENGTH) {
    return { valid: false, reason: 'too_long' };
  }

  for (const label of hostname.split('.')) {
    if (label.length === 0) {
      return { valid: false, reason: 'empty_label' };
    }

    if (label.length > MAX_LABEL_LENGTH) {
      return { valid: false, reason: 'label_too_long' };
    }

    if (label.startsWith('-')) {
      return { valid: false, reason: 'leading_hyphen' };
    }

    if (label.endsWith('-')) {
      return { valid: false, reason: 'trailing_hyphen' };
    }

    if (!LABEL_PATTERN.test(label)) {
      return { valid: false, reason: 'invalid_characters' };
    }
  }

  return { valid: true };
}

export type HostnameDnsCheckResult =
  | { status: 'resolved_match' }
  | { status: 'resolved_mismatch'; resolvedIps: string[] }
  | { status: 'not_resolved' };

export type HostnameLiveStatus =
  | { status: 'router_missing' }
  | { status: 'cert_pending' }
  | { status: 'cert_active'; issuer: string; validTo: string }
  | { status: 'unreachable' };
