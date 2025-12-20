import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile epubjs and its dependencies for Turbopack compatibility
  transpilePackages: ['epubjs', 'jszip', 'es5-ext'],
};

export default nextConfig;
