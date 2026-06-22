import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans, Poppins } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/layout/service-worker-register";
import { ThemeProvider, THEME_FOUC_SCRIPT } from "@/components/theme/theme-provider";

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

// Poppins ExtraBold — used only for the brand wordmark (dockly LOGISTICS).
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["800"],
  style: ["normal", "italic"],
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
