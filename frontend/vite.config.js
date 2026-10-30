import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: 'production-content-security-policy',
    transformIndexHtml() {
      if (command !== 'build') return [];
      return [{ tag: 'meta', attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: "default-src 'self'; script-src 'self' https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://accounts.google.com/gsi/; frame-src https://accounts.google.com/gsi/; object-src 'none'; base-uri 'self'; form-action 'self'",
      }, injectTo: 'head-prepend' }];
    },
  }],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
}));
