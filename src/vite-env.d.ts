/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENSEARCH_BASE_URL: string;
  readonly VITE_OPENSEARCH_INDEX: string;
  readonly VITE_OPENSEARCH_DEFAULT_USER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
