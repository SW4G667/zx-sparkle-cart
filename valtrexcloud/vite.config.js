import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { publicSiteMetadata } from './site-config.mjs';

export default defineConfig(({mode})=>({ plugins: [react(),publicSiteMetadata(process.env.VITE_PUBLIC_SITE_URL||loadEnv(mode,import.meta.dirname,'VITE_PUBLIC_').VITE_PUBLIC_SITE_URL)], build: { rollupOptions: { input: {
  main: resolve(import.meta.dirname, 'index.html'), plans: resolve(import.meta.dirname, 'plans/index.html'),
} } } }));
