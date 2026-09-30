/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No ESLint setup in this demo; type safety comes from `npm run typecheck`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
