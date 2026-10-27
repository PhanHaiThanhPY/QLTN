/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: login form prefill (web/.env.local); a production build drops it. */
  readonly VITE_DEV_LOGIN_USERNAME?: string;
  readonly VITE_DEV_LOGIN_PASSWORD?: string;
}
