/** @type {import('next').NextConfig} */
function contractorPortalBase() {
  const fromEnv = (process.env.NEXT_PUBLIC_CONTRACTOR_PORTAL_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) {
    return /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;
  }
  return process.env.NODE_ENV === "development"
    ? "http://localhost:3101"
    : "https://contractor.kleenapp.co.uk";
}

const nextConfig = {
  async redirects() {
    const base = contractorPortalBase();
    return [
      { source: "/contractor", destination: `${base}/contractor`, permanent: false },
      { source: "/contractor/:path*", destination: `${base}/contractor/:path*`, permanent: false },
    ];
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        },
      ],
    },
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
