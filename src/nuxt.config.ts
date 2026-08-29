import { fileURLToPath } from 'node:url';

// static headers only - these never depend on runtime config, so they're
// safe to bake in at build time via routeRules. HSTS is NOT here: whether
// this instance is HTTP-only (INSECURE env var) is a runtime deployment
// choice, and nuxt.config.ts only ever runs once during `nuxt build` - a
// process.env read here would freeze in whatever was true at build time,
// not the container's actual runtime environment. HSTS is set instead in
// server/plugins/securityHeaders.ts, which runs on every request.
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // no external scripts/styles/fonts are loaded anywhere in this app, so
  // default-src 'self' is safe; 'unsafe-inline' is kept for script/style
  // since Nuxt's SSR hydration payload and some Vue-managed inline styles
  // rely on it - COEP is intentionally not set here, it mainly protects
  // features (SharedArrayBuffer) this app doesn't use, and is the header
  // most likely to silently break an unrelated future integration
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-06-19',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/i18n',
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    'reka-ui/nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
  ],
  colorMode: {
    preference: 'system',
    fallback: 'light',
    storage: 'cookie',
    storageKey: 'theme',
  },
  css: ['~/app.css'],
  routeRules: {
    '/**': { headers: securityHeaders },
  },
  i18n: {
    // https://i18n.nuxtjs.org/docs/guide/server-side-translations
    experimental: {
      localeDetector: './localeDetector.ts',
    },
    // https://wg-easy.github.io/wg-easy/latest/contributing/translation/
    locales: [
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
      },
      {
        code: 'de',
        language: 'de-DE',
        name: 'Deutsch',
      },
      {
        code: 'es',
        language: 'es-ES',
        name: 'Español',
      },
      {
        code: 'it',
        language: 'it-IT',
        name: 'Italiano',
      },
      {
        code: 'ja',
        language: 'ja-JP',
        name: '日本語',
      },
      {
        code: 'fr',
        language: 'fr-FR',
        name: 'Français',
      },
      {
        code: 'ko',
        language: 'ko-KR',
        name: '한국어',
      },
      {
        code: 'ru',
        language: 'ru-RU',
        name: 'Русский',
      },
      {
        code: 'uk',
        language: 'uk-UA',
        name: 'Українська',
      },
      {
        code: 'zh-CN',
        language: 'zh-CN',
        name: '简体中文',
      },
      {
        code: 'zh-HK',
        language: 'zh-HK',
        name: '繁體中文（香港）',
      },
      {
        code: 'zh-TW',
        language: 'zh-TW',
        name: '正體中文 (台灣)',
      },
      {
        code: 'pl',
        language: 'pl-PL',
        name: 'Polski',
      },
      {
        code: 'cs',
        language: 'cs-CZ',
        name: 'Čeština',
      },
      {
        code: 'pt-BR',
        language: 'pt-BR',
        name: 'Português (Brasil)',
      },
      {
        code: 'tr',
        language: 'tr-TR',
        name: 'Türkçe',
      },
      {
        code: 'bn',
        language: 'bn-BD',
        name: 'বাংলা',
      },
      {
        code: 'id',
        language: 'id-ID',
        name: 'Bahasa Indonesia',
      },
      {
        code: 'nl',
        language: 'nl-NL',
        name: 'Nederlands',
      },
      {
        code: 'nb',
        language: 'nb-NO',
        name: 'Norsk bokmål',
      },
      {
        code: 'bg',
        language: 'bg-BG',
        name: 'Български',
      },
      {
        code: 'hi',
        language: 'hi-IN',
        name: 'हिन्दी',
      },
      {
        code: 'gl',
        language: 'gl-ES',
        name: 'Galego',
      },
      {
        code: 'ka',
        language: 'ka-GE',
        name: 'ქართული',
      },
      {
        code: 'vi',
        language: 'vi-VN',
        name: 'Tiếng Việt',
      },
    ],
    defaultLocale: 'en',
    vueI18n: './i18n.config.ts',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
    },
  },
  nitro: {
    imports: {
      autoImport: false,
    },
    esbuild: {
      options: {
        target: 'node24',
      },
    },
    externals: {
      traceInclude: [
        fileURLToPath(
          new URL('./node_modules/.cache/wg-easy/trace.mjs', import.meta.url)
        ),
      ],
    },
  },
  alias: {
    '#db': fileURLToPath(new URL('./server/database/', import.meta.url)),
    '#cli': fileURLToPath(new URL('./cli', import.meta.url)),
  },
});
