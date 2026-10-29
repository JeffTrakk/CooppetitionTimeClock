import type { MetadataRoute } from "next";

// Generic install manifest. Per-company names/icons come from branding once
// each client has its own domain or subdomain (see docs/ARCHITECTURE.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TimeClock",
    short_name: "TimeClock",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f5",
    theme_color: "#1b1d1a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
