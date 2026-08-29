export type CertificateInvalidReason =
  | 'invalid_type'
  | 'invalid_certificate_pem'
  | 'invalid_private_key_pem'
  | 'private_key_encrypted'
  | 'key_does_not_match_certificate';

export type CertificateWarning =
  'expired' | 'expiring_soon' | 'hostname_mismatch';

export type CertificateSaveResult =
  | { valid: true; warnings: CertificateWarning[] }
  | { valid: false; reason: CertificateInvalidReason };
