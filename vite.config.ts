import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { storagePlugin } from './vite-plugin-storage';
import { insightsPlugin } from './vite-plugin-insights';
import { librariesPlugin } from './vite-plugin-libraries';

export default defineConfig({
  plugins: [vue(), storagePlugin(), insightsPlugin(), librariesPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  envDir: '.',
  server: {
    proxy: {
      '/opensearch': {
        target:
          'https://vpc-bling-logs-1-xmo44hpibar6jsjgyp4poj2emi.us-east-1.es.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opensearch/, ''),
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
});
