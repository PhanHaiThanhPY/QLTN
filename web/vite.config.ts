/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Vendor groups split out of the app bundle so each chunk stays well under 500 kB. */
const VENDOR_CHUNKS = {
  react: ['react', 'react-dom', 'react-router', 'scheduler'],
  radix: ['radix-ui', '@radix-ui'],
  query: ['@tanstack/react-query', '@tanstack/query-core'],
  dates: ['date-fns', '@date-fns/tz'],
  dexie: ['dexie'],
  icons: ['lucide-react'],
  forms: ['zod', 'react-hook-form', '@hookform/resolvers'],
} as const;

const vendorChunkOf = (id: string): string | undefined => {
  const normalized = id.replaceAll('\\', '/');
  const index = normalized.lastIndexOf('/node_modules/');
  if (index < 0) return undefined;
  const segments = normalized.slice(index + '/node_modules/'.length).split('/');
  const packageName = segments[0].startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0];
  const scope = packageName.split('/')[0];
  const entry = Object.entries(VENDOR_CHUNKS).find(([, packages]) =>
    packages.some((name) => name === packageName || name === scope),
  );
  return entry ? `vendor-${entry[0]}` : undefined;
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5190 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunkOf,
      },
    },
  },
  // Pre-bundle lazily imported deps so the dev server never re-optimizes mid-session
  // (that mixes two React copies and breaks hooks until a reload).
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router',
      'react-hook-form',
      '@hookform/resolvers/zod',
      'zod',
      'radix-ui',
      'dexie',
      'sonner',
      'zustand',
      '@tanstack/react-query',
      'lucide-react',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Service tests intentionally share a replaceable IndexedDB/session singleton.
    // Running files in parallel lets one test replace another test's active database.
    fileParallelism: false,
  },
});
