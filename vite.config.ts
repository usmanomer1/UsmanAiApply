import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
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
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Generate source maps for Sentry
    sourcemap: true,
    // Improve chunk loading reliability
    rollupOptions: {
      output: {
        // Ensure stable chunk names for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Split vendor libraries into separate chunks
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'framer-motion', '@radix-ui/react-dialog'],
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
          convex: ['convex']
        }
      }
    },
    // Increase chunk size warning limit to avoid unnecessary warnings
    chunkSizeWarningLimit: 1000,
  },
});
