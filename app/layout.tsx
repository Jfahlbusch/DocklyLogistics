import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DocklyLogistics",
  description: "Logistik- und Rohstoffverwaltung",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DocklyLogistics",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F2A44",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="bg-stone-50 text-stone-900 antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
