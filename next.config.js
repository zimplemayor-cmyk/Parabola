/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // next/image only speaks http/https. Token metadata images that use
    // ipfs:// URIs are rewritten to an https gateway URL in lib/format.ts
    // (resolveImageUrl) before they ever reach <Image>, rather than trying
    // to configure the optimizer for a protocol it can't fetch directly.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
