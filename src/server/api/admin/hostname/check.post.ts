import { createError, readBody, setResponseStatus } from 'h3';

import Database from '#server/utils/Database';
import { definePermissionEventHandler } from '#server/utils/handler';
import { checkHostnameDns } from '#server/utils/hostnameDns';
import { validateHostname } from '#shared/utils/hostname';
import type {
  HostnameDnsCheckResult,
  HostnameValidationResult,
} from '#shared/utils/hostname';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({
    event,
  }): Promise<HostnameDnsCheckResult | HostnameValidationResult> => {
    const { serverPublicIp } = await Database.general.getHostnameSettings();

    if (!serverPublicIp) {
      throw createError({
        statusCode: 503,
        statusMessage:
          'DNS check is not configured - set your Server Public IP first',
      });
    }

    const body = await readBody<{ hostname?: unknown }>(event);

    if (typeof body?.hostname !== 'string') {
      setResponseStatus(event, 400);
      return { valid: false, reason: 'invalid_type' };
    }

    const validation = validateHostname(body.hostname);

    if (!validation.valid) {
      setResponseStatus(event, 400);
      return validation;
    }

    return checkHostnameDns(body.hostname, serverPublicIp);
  }
);
