import { defineConfig, devices } from '@playwright/test';

const FLOWS = ['convert.spec.ts', 'gallery.spec.ts', 'backup.spec.ts', 'card.spec.ts', 'bg-removal.spec.ts', 'melhorias.spec.ts'];

// Roda sobre o build de produção, com o motor de remoção de fundo simulado (.env.e2e): sem rede externa.
export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: '**/*.network.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'celular',
      testMatch: ['convert.spec.ts', 'gallery.spec.ts', 'responsive.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 740 },
        hasTouch: true,
      },
    },
    // Os testes que leem a área de transferência dependem de permissão só disponível no Chromium.
    {
      name: 'firefox',
      testMatch: FLOWS,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: FLOWS,
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npx vite build --mode e2e --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
