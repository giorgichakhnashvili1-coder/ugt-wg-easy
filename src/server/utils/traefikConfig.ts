import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';

import { parse, stringify } from 'yaml';

import Database from '#server/utils/Database';
import { SERVER_DEBUG, WG_ENV } from '#server/utils/config';

export const ROUTER_NAME = 'wg-admin';
const SERVICE_NAME = 'wg-easy-svc';
// this app's own Docker Compose service/container name - Traefik and this
// app run as separate containers, so the backend must be addressed by its
// name on the shared Docker network (resolved via Docker's embedded DNS),
// not 127.0.0.1, which would be Traefik's own loopback
const BACKEND_HOST = 'wg-easy';

// serializes concurrent writes so two quick Saves can't interleave
let writeQueue: Promise<unknown> = Promise.resolve();

function certsDir(dynamicConfigPath: string) {
  return join(dirname(dynamicConfigPath), 'certs');
}

/** fixed, single-cert paths - matches the "exactly one router/service/cert" convention */
export function customCertPaths(dynamicConfigPath: string) {
  const dir = certsDir(dynamicConfigPath);
  return {
    certFilePath: join(dir, 'cert.pem'),
    keyFilePath: join(dir, 'key.pem'),
  };
}

function renderConfig(
  hostname: string,
  tls:
    | { mode: 'acme'; certResolver: string }
    | { mode: 'custom'; certFilePath: string; keyFilePath: string },
  port: string
) {
  const doc: Record<string, unknown> = {
    http: {
      routers: {
        [ROUTER_NAME]: {
          rule: `Host(\`${hostname}\`)`,
          service: SERVICE_NAME,
          tls: tls.mode === 'acme' ? { certResolver: tls.certResolver } : {},
        },
      },
      services: {
        [SERVICE_NAME]: {
          loadBalancer: {
            servers: [{ url: `http://${BACKEND_HOST}:${port}` }],
          },
        },
      },
    },
  };

  if (tls.mode === 'custom') {
    doc.tls = {
      certificates: [{ certFile: tls.certFilePath, keyFile: tls.keyFilePath }],
    };
  }

  return stringify(doc);
}

/**
 * best-effort read of the hostname currently configured in the existing
 * dynamic config file, for audit logging. returns null if there is no
 * existing file, or it doesn't have the shape we expect.
 */
async function readCurrentHostname(path: string): Promise<string | null> {
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch {
    return null;
  }

  try {
    const parsed: unknown = parse(content);
    const rule = (
      parsed as {
        http?: { routers?: Record<string, { rule?: string }> };
      }
    )?.http?.routers?.[ROUTER_NAME]?.rule;

    const match = typeof rule === 'string' && /^Host\(`([^`]+)`\)$/.exec(rule);
    return match ? match[1]! : null;
  } catch {
    return null;
  }
}

async function atomicWriteFile(path: string, content: string, mode?: number) {
  const tempPath = join(
    dirname(path),
    `.${basename(path)}.${randomUUID()}.tmp`
  );

  await writeFile(tempPath, content, { encoding: 'utf-8', mode });
  await rename(tempPath, path);
}

function wrapWriteError(error: unknown): never {
  const code =
    error instanceof Error
      ? ((error as NodeJS.ErrnoException).code ?? error.message)
      : 'unknown';
  throw new Error(`write_failed:${code}`, { cause: error });
}

async function writeDynamicConfig(
  path: string,
  hostname: string,
  tls: Parameters<typeof renderConfig>[1]
) {
  const run = writeQueue.then(async () => {
    const oldHostname = await readCurrentHostname(path);
    const content = renderConfig(hostname, tls, WG_ENV.PORT);

    try {
      await atomicWriteFile(path, content);
    } catch (error) {
      wrapWriteError(error);
    }

    SERVER_DEBUG(
      `Traefik dynamic config updated: hostname ${oldHostname ?? '(none)'} -> ${hostname} (tls: ${tls.mode})`
    );
  });

  // keep the queue moving even if this write failed, and don't let a
  // failure here surface as an unhandled rejection on the shared queue
  writeQueue = run.catch(() => undefined);

  return run;
}

/**
 * write the Traefik dynamic config router+service for `hostname`, using
 * whichever TLS mode (automatic ACME or a previously uploaded custom
 * certificate) is currently configured.
 *
 * @throws if Traefik integration isn't configured, or the write fails
 */
export async function writeTraefikConfigForHostname(hostname: string) {
  const { TRAEFIK_DYNAMIC_CONFIG_PATH: path, TRAEFIK_CERT_RESOLVER } = WG_ENV;

  if (!path || !TRAEFIK_CERT_RESOLVER) {
    throw new Error('not_configured');
  }

  const { certMode } = await Database.general.getHostnameSettings();

  const tls: Parameters<typeof renderConfig>[1] =
    certMode === 'custom'
      ? { mode: 'custom', ...customCertPaths(path) }
      : { mode: 'acme', certResolver: TRAEFIK_CERT_RESOLVER };

  return writeDynamicConfig(path, hostname, tls);
}

/**
 * validate+store a custom certificate/key, switch this router to use it,
 * and rewrite the dynamic config file.
 *
 * @throws if Traefik integration isn't configured, or a write fails
 */
export async function writeCustomCertificate(
  hostname: string,
  certPem: string,
  keyPem: string
) {
  const { TRAEFIK_DYNAMIC_CONFIG_PATH: path } = WG_ENV;

  if (!path) {
    throw new Error('not_configured');
  }

  const { certFilePath, keyFilePath } = customCertPaths(path);

  await mkdir(certsDir(path), { recursive: true });

  try {
    await atomicWriteFile(certFilePath, certPem);
    await atomicWriteFile(keyFilePath, keyPem, 0o600);
  } catch (error) {
    wrapWriteError(error);
  }

  await Database.general.updateCertMode('custom');

  return writeDynamicConfig(path, hostname, {
    mode: 'custom',
    certFilePath,
    keyFilePath,
  });
}

/**
 * switch this router back to automatic ACME certificate issuance.
 * previously uploaded cert/key files are left on disk (not deleted), so
 * switching back to custom mode later doesn't require a re-upload.
 *
 * @throws if Traefik integration isn't configured, or the write fails
 */
export async function switchToAutomaticCert(hostname: string) {
  const { TRAEFIK_DYNAMIC_CONFIG_PATH: path, TRAEFIK_CERT_RESOLVER } = WG_ENV;

  if (!path || !TRAEFIK_CERT_RESOLVER) {
    throw new Error('not_configured');
  }

  await Database.general.updateCertMode('acme');

  return writeDynamicConfig(path, hostname, {
    mode: 'acme',
    certResolver: TRAEFIK_CERT_RESOLVER,
  });
}
