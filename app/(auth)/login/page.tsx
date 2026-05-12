import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";
  const error = params.error;

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center text-gold-500 font-display text-xl">
              L
            </div>
            <div>
              <CardTitle className="font-display text-2xl text-navy-900">DocklyLogistics</CardTitle>
              <CardDescription className="text-xs tracking-[0.18em] uppercase text-stone-500">
                Logistikverwaltung
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "unauthorized" && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Kein Zugriff für diesen Tenant. Bitte wende dich an deinen Administrator.
            </div>
          )}
          <p className="text-sm text-stone-600">
            Anmeldung über Keycloak (BackOfficeDigital).
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("keycloak", { redirectTo: callbackUrl });
            }}
          >
            <Button type="submit" className="w-full bg-navy-900 hover:bg-navy-700 text-white">
              Mit Keycloak anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
