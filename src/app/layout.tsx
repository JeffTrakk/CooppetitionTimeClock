import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSession();
  const name = s?.company.branding.appName ?? "TimeClock";
  return { title: name, description: "Crew time clock, scheduling and payroll export.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: name } };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b1d1a" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await getSession();
  const style = s ? ({ "--brand": s.company.branding.primaryColor, "--accent": s.company.branding.accentColor } as CSSProperties) : undefined;
  return (
    <html lang="en">
      <body style={style} className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
