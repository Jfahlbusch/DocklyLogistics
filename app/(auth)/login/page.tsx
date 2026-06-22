import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";
import { loginWithKeycloak } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";
  const error = params.error;

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md shadow-soft">
        <CardHeader className="space-y-2">
          <div className="flex flex-col items-center gap-2">
            <Logo variant="auto" />
            <CardDescription className="text-xs tracking-[0.18em] uppercase text-muted-foreground">
              Logistikverwaltung
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error === "unauthorized" && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Kein Zugriff für diesen Tenant. Bitte wende dich an deinen Administrator.
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Anmeldung über Keycloak (BackOfficeDigital).
          </p>
          <form action={loginWithKeycloak}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" className="w-full bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900">
              Mit Keycloak anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
