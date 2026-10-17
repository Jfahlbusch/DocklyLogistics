import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Schlankes Layout für Druckseiten: keine App-Shell, aber Anmeldung wird geprüft.
 * Immer helle Darstellung (auch im Dunkelmodus) — der Inhalt wird gedruckt.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");
  return (
    <div className="min-h-dvh" style={{ background: "#fff", color: "#000", colorScheme: "light" }}>
      {children}
    </div>
  );
}
