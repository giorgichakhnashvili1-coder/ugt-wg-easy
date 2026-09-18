import { setupNuxt } from "./shared/nuxt.mjs";
import { setupWindow } from "./shared/environment.mjs";
import environmentOptions from "nuxt-vitest-environment-options";
//#region src/runtime/browser-entry.ts
await setupWindow(window, environmentOptions);
await setupNuxt();
//#endregion
export {};
