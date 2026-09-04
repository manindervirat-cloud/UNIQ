/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
    ],
  },
  async rewrites() {
    // Proxy API calls to the FastAPI backend so the browser only ever
    // talks to one origin (no CORS issues in production behind a proxy).
    const api =
      process.env.NEXT_PUBLIC_API_URL ??
      process.env.API_ORIGIN ??
      "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
