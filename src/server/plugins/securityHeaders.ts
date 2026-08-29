import { defineNitroPlugin } from 'nitropack/runtime';
import { removeResponseHeader, setResponseHeader } from 'h3';

import { WG_ENV } from '#server/utils/config';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    // strip framework fingerprinting - routeRules headers (nuxt.config.ts)
    // can only add headers, not remove ones Nitro sets later in the
    // response lifecycle, so this needs its own hook right before the
    // response is sent
    removeResponseHeader(event, 'x-powered-by');

    // only ever set over an actually-secure deployment. Unlike the static
    // headers in nuxt.config.ts, this can't be decided at build time -
    // INSECURE is a runtime deployment choice, checked fresh on every
    // request here (not frozen into the build), so the same image behaves
    // correctly whether it's run with INSECURE=true or false
    if (!WG_ENV.INSECURE) {
      setResponseHeader(
        event,
        'Strict-Transport-Security',
        'max-age=15552000; includeSubDomains'
      );
    }
  });
});
