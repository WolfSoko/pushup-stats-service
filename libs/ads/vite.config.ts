import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { resolve } from 'path';

const root = resolve(__dirname);

export default defineConfig({
  plugins: [
    angular({
      tsconfig: resolve(root, 'tsconfig.spec.json'),
      jit: false,
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(root, 'src/test-setup.ts')],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
    },
    server: {
      deps: {
        // Inline ESM-only packages that Vitest cannot handle otherwise
        inline: [
          /rxfire/,
          /@firebase/,
          /firebase/,
          /@angular\/fire/,
          'generator-function',
          'is-generator-function',
        ],
      },
    },
  },
});
