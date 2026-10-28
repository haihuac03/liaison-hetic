/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingExcludes: {
    "/*": [
      "./data/**/*",
      "./scripts/**/*",
      "./docs/**/*",
      "./.env*",
      "./*.sqlite*",
      "./tsconfig.tsbuildinfo",
    ],
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" },
      ],
    }];
  },
};

export default nextConfig;
