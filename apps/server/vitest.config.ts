import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Claim-engine tests talk to a real Redis; keep them serial + give time for connect.
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 15_000,
  },
});
