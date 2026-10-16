// Nur für Vitest: ein Signaturschlüssel für die x-user-*-Header. In Produktion
// gibt es bewusst KEINEN Ersatzwert — fehlt NEXTAUTH_SECRET, schlägt die Signatur fehl.
process.env.NEXTAUTH_SECRET ??= "vitest-only-user-header-secret";
