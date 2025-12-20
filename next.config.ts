import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile epubjs and its dependencies for Turbopack compatibility
  transpilePackages: ['epubjs', 'jszip', 'es5-ext'],
  // Static export for Electron production build
  output: process.env.BUILD_TARGET === 'electron' ? 'export' : undefined,
};

export default nextConfig;
