import { randomBytes } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';

import { oneTimeLink } from './schema';

import type { ID } from '#server/utils/types';
import type { DBType } from '#db/sqlite';

function createPreparedStatement(db: DBType) {
  return {
    delete: db
      .delete(oneTimeLink)
      .where(eq(oneTimeLink.id, sql.placeholder('id')))
      .prepare(),
    create: db
      .insert(oneTimeLink)
      .values({
        id: sql.placeholder('id'),
        oneTimeLink: sql.placeholder('oneTimeLink'),
        expiresAt: sql.placeholder('expiresAt'),
      })
      .onConflictDoUpdate({
        target: oneTimeLink.id,
        set: {
          // regenerating for a client that already has a row must actually
          // rotate the token, not just extend the old one's expiry -
          // otherwise "regenerate" never revokes a previously issued link
          oneTimeLink: sql.placeholder('oneTimeLink') as never as string,
          expiresAt: sql.placeholder('expiresAt') as never as string,
        },
      })
      .prepare(),
    erase: db
      .update(oneTimeLink)
      .set({ expiresAt: sql.placeholder('expiresAt') as never as string })
      .where(eq(oneTimeLink.id, sql.placeholder('id')))
      .prepare(),
    findByOneTimeLink: db.query.oneTimeLink
      .findFirst({
        where: eq(oneTimeLink.oneTimeLink, sql.placeholder('oneTimeLink')),
      })
      .prepare(),
  };
}

export class OneTimeLinkService {
  #statements: ReturnType<typeof createPreparedStatement>;

  constructor(db: DBType) {
    this.#statements = createPreparedStatement(db);
  }

  delete(id: ID) {
    return this.#statements.delete.execute({ id });
  }

  getByOtl(oneTimeLink: string) {
    return this.#statements.findByOneTimeLink.execute({ oneTimeLink });
  }

  generate(id: ID) {
    // 256 bits from a CSPRNG - unguessable within the expiry window
    const oneTimeLink = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return this.#statements.create.execute({ id, oneTimeLink, expiresAt });
  }

  erase(id: ID) {
    // SECURITY
    // This is known the extend the Window for brute force attacks
    // Reason: Set the expiresAt to 10 seconds in the future to allow a second request to get the otl
    // some browser apparently make two requests when downloading a file
    // cant find the bug report anymore, maybe this can be removed?
    const expiresAt = new Date(Date.now() + 10 * 1000).toISOString();
    return this.#statements.erase.execute({ id, expiresAt });
  }
}
