/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROUTER_BASE_URL: string;
  readonly VITE_LLM_BASE_URL: string;
  readonly VITE_DEFAULT_MODEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
