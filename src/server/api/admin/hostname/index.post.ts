import { createError, readBody, setResponseStatus } from 'h3';

import Database from '#server/utils/Database';
import { definePermissionEventHandler } from '#server/utils/handler';
import { writeTraefikConfigForHostname } from '#server/utils/traefikConfig';
import { validateHostname } from '#shared/utils/hostname';
import type { HostnameValidationResult } from '#shared/utils/hostname';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }): Promise<HostnameValidationResult> => {
    const body = await readBody<{ hostname?: unknown }>(event);

    if (typeof body?.hostname !== 'string') {
      setResponseStatus(event, 400);
      return { valid: false, reason: 'invalid_type' };
    }

    const result = validateHostname(body.hostname);

    if (!result.valid) {
      setResponseStatus(event, 400);
      return result;
    }

    try {
      await writeTraefikConfigForHostname(body.hostname);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';

      if (reason === 'not_configured') {
        throw createError({
          statusCode: 503,
          statusMessage:
            'Traefik integration is not configured on this server (missing TRAEFIK_DYNAMIC_CONFIG_PATH or TRAEFIK_CERT_RESOLVER)',
        });
      }

      const code = reason.startsWith('write_failed:')
        ? reason.slice('write_failed:'.length)
        : 'unknown';

      throw createError({
        statusCode: 500,
        statusMessage: `Failed to update Traefik configuration (${code})`,
      });
    }

    await Database.general.updateAdminHostname(body.hostname);

    return result;
  }
);
