import { connect as tlsConnect } from 'node:tls';

import { SERVER_DEBUG } from '#server/utils/config';
import { ROUTER_NAME } from '#server/utils/traefikConfig';
import type { HostnameLiveStatus } from '#shared/utils/hostname';

// same Docker network container names as traefikConfig.ts - see the note
// there on why 127.0.0.1 would be wrong here too
const TRAEFIK_HOST = 'traefik';
const TRAEFIK_API_PORT = 8080;
const TRAEFIK_HTTPS_PORT = 443;
const PROBE_TIMEOUT_MS = 4000;
// Traefik's fallback cert when no ACME cert has been issued yet for a router
const SELF_SIGNED_ISSUER_CN = 'TRAEFIK DEFAULT CERT';

async function fetchRouter(routerName: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(
      `http://${TRAEFIK_HOST}:${TRAEFIK_API_PORT}/api/http/routers/${encodeURIComponent(routerName)}`,
      { signal: controller.signal }
    );

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`unexpected status ${res.status}`);
    }

    return (await res.json()) as { rule?: string };
  } finally {
    clearTimeout(timer);
  }
}

type ProbedCert = { issuerCN: string; issuerO: string | null; validTo: string };

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function probeCertificate(hostname: string): Promise<ProbedCert | null> {
  return new Promise((resolve) => {
    const socket = tlsConnect(
      {
        host: TRAEFIK_HOST,
        port: TRAEFIK_HTTPS_PORT,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: PROBE_TIMEOUT_MS,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const issuerCN = firstOf(cert?.issuer?.CN);
        socket.end();

        resolve(
          issuerCN
            ? {
                issuerCN,
                issuerO: firstOf(cert.issuer?.O) ?? null,
                validTo: cert.valid_to,
              }
            : null
        );
      }
    );

    socket.on('error', () => resolve(null));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

/**
 * checks whether `hostname` currently has a live Traefik router pointing at
 * it, and whether it's serving a real (non-self-signed) certificate.
 * never throws - unreachable/errors fold into `unreachable`.
 */
export async function getHostnameLiveStatus(
  hostname: string
): Promise<HostnameLiveStatus> {
  let router: { rule?: string } | null;

  try {
    router = await fetchRouter(`websecure-${ROUTER_NAME}@file`);
  } catch (error) {
    SERVER_DEBUG(`Traefik API status check failed: ${error}`);
    return { status: 'unreachable' };
  }

  if (!router || router.rule !== `Host(\`${hostname}\`)`) {
    return { status: 'router_missing' };
  }

  const cert = await probeCertificate(hostname);

  if (cert === null) {
    return { status: 'unreachable' };
  }

  if (cert.issuerCN === SELF_SIGNED_ISSUER_CN) {
    return { status: 'cert_pending' };
  }

  return {
    status: 'cert_active',
    issuer: cert.issuerO ?? cert.issuerCN,
    validTo: cert.validTo,
  };
}
