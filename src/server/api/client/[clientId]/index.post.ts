import { getValidatedRouterParams, readValidatedBody } from 'h3';

import Database from '#server/utils/Database';
import WireGuard from '#server/utils/WireGuard';
import { definePermissionEventHandler } from '#server/utils/handler';
import { validateZod } from '#server/utils/types';
import { roles } from '#shared/utils/permissions';
import {
  ClientGetSchema,
  ClientUpdateSchema,
} from '#db/repositories/client/types';

export default definePermissionEventHandler(
  'clients',
  'update',
  async ({ event, user, checkPermissions }) => {
    const { clientId } = await getValidatedRouterParams(
      event,
      validateZod(ClientGetSchema, event)
    );

    const data = await readValidatedBody(
      event,
      validateZod(ClientUpdateSchema, event)
    );

    const client = await Database.clients.get(clientId);
    checkPermissions(client);

    // serverAllowedIps controls what source IPs the server's WireGuard peer
    // config trusts as coming from this client - an admin-only routing
    // decision, not a client self-service setting. Non-admins keep
    // whatever value is already on the client record.
    const update =
      user.role === roles.ADMIN
        ? data
        : { ...data, serverAllowedIps: client?.serverAllowedIps ?? [] };

    await Database.clients.update(clientId, update);
    await WireGuard.saveConfig();

    return { success: true };
  }
);
