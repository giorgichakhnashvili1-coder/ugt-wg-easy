import { createError } from 'h3';

import Database from '#server/utils/Database';
import { definePermissionEventHandler } from '#server/utils/handler';
import { switchToAutomaticCert } from '#server/utils/traefikConfig';

export default definePermissionEventHandler('admin', 'any', async () => {
  const { hostname } = await Database.general.getHostnameSettings();

  if (!hostname) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No hostname is configured',
    });
  }

  try {
    await switchToAutomaticCert(hostname);
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
      statusMessage: `Failed to update Traefik configuration (${code})`,
    });
  }

  return { success: true };
});
