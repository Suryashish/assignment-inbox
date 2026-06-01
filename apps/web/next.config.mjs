import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // realtime socket app — avoid dev double-connect churn
  transpilePackages: ['@ctb/shared'],
  // Hide the dev-tools indicator (it overlaps the bottom-left board controls).
  devIndicators: false,
  // Standalone output is only needed for the slim Docker image. It uses symlinks
  // that Windows hosts block, so we gate it behind a flag the Dockerfile sets.
  output: process.env.BUILD_STANDALONE ? 'standalone' : undefined,
  // Trace from the monorepo root so the standalone bundle includes workspace deps.
  outputFileTracingRoot: path.join(dirname, '../../'),
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
