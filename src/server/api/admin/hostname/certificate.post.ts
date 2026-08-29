import { createError, readBody, setResponseStatus } from 'h3';

import Database from '#server/utils/Database';
import { validateCertificate } from '#server/utils/certificate';
import { definePermissionEventHandler } from '#server/utils/handler';
import { writeCustomCertificate } from '#server/utils/traefikConfig';
import type { CertificateSaveResult } from '#shared/utils/certificate';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }): Promise<CertificateSaveResult> => {
    const body = await readBody<{
      certificate?: unknown;
      privateKey?: unknown;
    }>(event);

    if (
      typeof body?.certificate !== 'string' ||
      typeof body?.privateKey !== 'string'
    ) {
      setResponseStatus(event, 400);
      return { valid: false, reason: 'invalid_type' };
    }

    const { hostname } = await Database.general.getHostnameSettings();

    if (!hostname) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Set and save a hostname before uploading a certificate',
      });
    }

    const result = validateCertificate(
      body.certificate,
      body.privateKey,
      hostname
    );

    if (!result.valid) {
      setResponseStatus(event, 400);
      return result;
    }

    try {
      await writeCustomCertificate(hostname, body.certificate, body.privateKey);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';

      if (reason === 'not_configured') {
        throw createError({
          statusCode: 503,
          statusMessage: 'Traefik integration is not configured on this server',
        });
      }

      const code = reason.startsWith('write_failed:')
        ? reason.slice('write_failed:'.length)
        : 'unknown';

      throw createError({
        statusCode: 500,
        statusMessage: `Failed to save certificate (${code})`,
      });
    }

    return result;
  }
);
