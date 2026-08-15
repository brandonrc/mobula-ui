/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-mode auth stub flag (spec §5.10). "true"/"false"; defaults on in dev. */
  readonly VITE_MOBULA_DEV_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
