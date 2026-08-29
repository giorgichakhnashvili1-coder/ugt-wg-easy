import { Resolver } from 'node:dns/promises';

import { SERVER_DEBUG } from '#server/utils/config';
import type { HostnameDnsCheckResult } from '#shared/utils/hostname';

const DNS_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('DNS lookup timed out')),
      ms
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error as Error);
      }
    );
  });
}

async function resolveIps(hostname: string) {
  const resolver = new Resolver();

  try {
    return await withTimeout(resolver.resolve4(hostname), DNS_TIMEOUT_MS);
  } catch (error) {
    // NXDOMAIN, no records, and a slow/hanging resolver all mean "no
    // confirmed record yet" from the caller's perspective, not a hard error
    SERVER_DEBUG(`DNS A lookup for ${hostname} failed: ${error}`);
    return [];
  }
}

/**
 * check whether `hostname` currently resolves to `serverPublicIp`.
 * never throws - DNS failures/timeouts fold into `not_resolved`.
 */
export async function checkHostnameDns(
  hostname: string,
  serverPublicIp: string
): Promise<HostnameDnsCheckResult> {
  const resolvedIps = await resolveIps(hostname);

  if (resolvedIps.length === 0) {
    return { status: 'not_resolved' };
  }

  if (resolvedIps.includes(serverPublicIp)) {
    return { status: 'resolved_match' };
  }

  return { status: 'resolved_mismatch', resolvedIps };
}
