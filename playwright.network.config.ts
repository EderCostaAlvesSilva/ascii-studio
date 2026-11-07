import { defineConfig, devices } from '@playwright/test';

// Teste real da remoção de fundo: baixa cerca de 54 MB do CDN da IMG.LY.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.network.spec.ts',
  reporter: 'list',
  timeout: 300_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4174' },
  webServer: {
    command: 'npx vite build --outDir dist-network --emptyOutDir && npx vite preview --outDir dist-network --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
