import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Only include Sentry plugin in production builds when auth token is available
    ...(process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: {
              name: process.env.VITE_SENTRY_RELEASE,
            },
            sourcemaps: {
              assets: './dist/**',
            },
          }),
        ]
      : []),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Generate source maps for Sentry
    sourcemap: true,
  },
});
