/** package.json's version, injected by vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** The house server's API, e.g. https://example.com/api (optional; see lib/houseDirectory.ts). */
  readonly VITE_HOUSE_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
