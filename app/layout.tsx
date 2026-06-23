import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import { ThemeProvider, THEME_FOUC_SCRIPT } from "@/components/theme/theme-provider";

// Self-hosted fonts (woff2 in ./fonts) so builds never depend on Google Fonts.
const playfair = localFont({
  src: [
    { path: "./fonts/playfair-display-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/playfair-display-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/playfair-display-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = localFont({
  src: [
    { path: "./fonts/dm-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/dm-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/dm-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

// Poppins ExtraBold — used only for the brand wordmark (dockly LOGISTICS).
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-800.woff2", weight: "800", style: "normal" },
    { path: "./fonts/poppins-800-italic.woff2", weight: "800", style: "italic" },
  ],
  variable: "--font-poppins",
  display: "swap",
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
  themeColor: "#041E24",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${playfair.variable} ${dmSans.variable} ${poppins.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_FOUC_SCRIPT }} />
        <ThemeProvider>
          {children}
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
