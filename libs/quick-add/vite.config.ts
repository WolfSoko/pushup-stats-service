import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { resolve } from 'path';

const root = resolve(__dirname);
const repoRoot = resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    conditions: ['browser', 'import', 'default'],
    alias: {
      '@pu-stats/data-access': resolve(
        repoRoot,
        'libs/data-access/src/index.ts'
      ),
      '@pu-stats/models': resolve(repoRoot, 'libs/stats/src/index.ts'),
      '@pu-stats/testing': resolve(repoRoot, 'libs/testing/src/index.ts'),
      '@pu-stats/ads': resolve(repoRoot, 'libs/ads/src/index.ts'),
      '@pu-auth/auth': resolve(repoRoot, 'libs/auth/src/index.ts'),
      '@pu-reminders/reminders': resolve(
        repoRoot,
        'libs/reminders/src/index.ts'
      ),
      '@pu-stats/quick-add': resolve(repoRoot, 'libs/quick-add/src/index.ts'),
    },
  },
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
        inline: [/rxfire/, /@firebase/, /firebase/, /@angular\/fire/],
      },
    },
  },
});
