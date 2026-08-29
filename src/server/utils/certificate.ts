import { X509Certificate, createPrivateKey } from 'node:crypto';

import type {
  CertificateSaveResult,
  CertificateWarning,
} from '#shared/utils/certificate';

const EXPIRING_SOON_DAYS = 14;

function isEncryptedKeyPem(keyPem: string): boolean {
  return (
    keyPem.includes('ENCRYPTED PRIVATE KEY') ||
    keyPem.includes('Proc-Type: 4,ENCRYPTED')
  );
}

/**
 * validate that `certPem`/`keyPem` are well-formed, unencrypted, and that
 * the key actually matches the certificate - a mismatch here would silently
 * break TLS for the router, so it's a hard failure, not a warning.
 * hostname/expiry issues are returned as warnings instead, since those
 * might be intentional (e.g. staging a cert ahead of a DNS cutover).
 */
export function validateCertificate(
  certPem: string,
  keyPem: string,
  hostname: string
): CertificateSaveResult {
  let cert: X509Certificate;

  try {
    cert = new X509Certificate(certPem);
  } catch {
    return { valid: false, reason: 'invalid_certificate_pem' };
  }

  if (isEncryptedKeyPem(keyPem)) {
    return { valid: false, reason: 'private_key_encrypted' };
  }

  let keyObject;
  try {
    keyObject = createPrivateKey(keyPem);
  } catch {
    return { valid: false, reason: 'invalid_private_key_pem' };
  }

  if (!cert.checkPrivateKey(keyObject)) {
    return { valid: false, reason: 'key_does_not_match_certificate' };
  }

  const warnings: CertificateWarning[] = [];

  const daysUntilExpiry =
    (new Date(cert.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry < 0) {
    warnings.push('expired');
  } else if (daysUntilExpiry < EXPIRING_SOON_DAYS) {
    warnings.push('expiring_soon');
  }

  try {
    if (!cert.checkHost(hostname)) {
      warnings.push('hostname_mismatch');
    }
  } catch {
    warnings.push('hostname_mismatch');
  }

  return { valid: true, warnings };
}
