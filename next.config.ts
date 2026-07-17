import type { NextConfig } from "next";

const securityHeaders = [
  // Empeche le MIME sniffing des reponses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking: interdit d'embarquer le studio dans une iframe.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Le studio n'utilise ni camera, ni micro, ni geolocalisation.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPS obligatoire pendant 2 ans (ignore en HTTP local).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
