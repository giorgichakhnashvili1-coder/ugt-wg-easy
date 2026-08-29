import { readBody, setResponseStatus } from 'h3';

import Database from '#server/utils/Database';
import { definePermissionEventHandler } from '#server/utils/handler';
import { validatePublicIp } from '#shared/utils/publicIp';
import type { PublicIpValidationResult } from '#shared/utils/publicIp';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }): Promise<PublicIpValidationResult> => {
    const body = await readBody<{ serverPublicIp?: unknown }>(event);

    if (typeof body?.serverPublicIp !== 'string') {
      setResponseStatus(event, 400);
      return { valid: false, reason: 'invalid_type' };
    }

    const result = validatePublicIp(body.serverPublicIp);

    if (!result.valid) {
      setResponseStatus(event, 400);
      return result;
    }

    await Database.general.updateServerPublicIp(body.serverPublicIp);

    return result;
  }
);
