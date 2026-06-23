/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Optional shop name printed on the thermal receipt (interim until tenant branding). */
  readonly VITE_SHOP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
