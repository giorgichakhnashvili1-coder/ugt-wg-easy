import { readBody, setResponseStatus } from 'h3';

import { definePermissionEventHandler } from '#server/utils/handler';
import { getHostnameLiveStatus } from '#server/utils/traefikStatus';
import { validateHostname } from '#shared/utils/hostname';
import type {
  HostnameLiveStatus,
  HostnameValidationResult,
} from '#shared/utils/hostname';

export default definePermissionEventHandler(
  'admin',
  'any',
  async ({ event }): Promise<HostnameLiveStatus | HostnameValidationResult> => {
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

    return getHostnameLiveStatus(body.hostname);
  }
);
