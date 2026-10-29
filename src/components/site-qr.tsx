import { headers } from "next/headers";
import QRCode from "qrcode";
import type { Job } from "@/lib/domain/types";

/** Public base URL: NEXT_PUBLIC_APP_URL in production, request host locally. */
export async function appUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Printable QR for the site entrance. Scanning opens /punch/qr/<token>. */
export async function SiteQr({ job, size = 160 }: { job: Job; size?: number }) {
  const url = `${await appUrl()}/punch/qr/${job.qrToken}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: size });
  return (
    <figure className="inline-block text-center">
      <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="mt-1 max-w-[220px] break-all text-[10px] text-stone-500">{url}</figcaption>
    </figure>
  );
}
