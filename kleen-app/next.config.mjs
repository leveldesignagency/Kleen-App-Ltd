/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    const base = (process.env.NEXT_PUBLIC_CONTRACTOR_PORTAL_URL || "").trim().replace(/\/$/, "");
    if (!base) return [];
    return [
      { source: "/contractor", destination: `${base}/contractor`, permanent: false },
      { source: "/contractor/:path*", destination: `${base}/contractor/:path*`, permanent: false },
    ];
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      ],
    },
  ],
};

export default nextConfig;
