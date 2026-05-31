import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // realtime socket app — avoid dev double-connect churn
  transpilePackages: ['@ctb/shared'],
  output: 'standalone',
  // Trace from the monorepo root so the standalone bundle includes workspace deps.
  outputFileTracingRoot: path.join(dirname, '../../'),
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
