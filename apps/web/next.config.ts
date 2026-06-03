import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/studio/admin",
        destination: "http://localhost:3001/",
        permanent: false,
        basePath: false,
      },
      {
        source: "/studio/admin/",
        destination: "http://localhost:3001/",
        permanent: false,
        basePath: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    const api = process.env.API_URL ?? "http://localhost:4000";
    return [
      { source: "/health", destination: `${api}/health` },
      { source: "/api/auth/login", destination: `${api}/api/auth/login` },
      { source: "/api/auth/register", destination: `${api}/api/auth/register` },
      { source: "/api/auth/me", destination: `${api}/api/auth/me` },
      { source: "/api/contributor/:path*", destination: `${api}/api/contributor/:path*` },
      { source: "/api/plugin/:path*", destination: `${api}/api/plugin/:path*` },
      { source: "/api/logs/:path*", destination: `${api}/api/logs/:path*` },
      {
        source: "/studio/contributor",
        destination: "/studio/contributor/index.html",
      },
      {
        source: "/studio/contributor/",
        destination: "/studio/contributor/index.html",
      },
      { source: "/studio/hub", destination: "/studio/hub.html" },
      { source: "/studio/login", destination: "/studio/login.html" },
    ];
  },
};

export default nextConfig;
