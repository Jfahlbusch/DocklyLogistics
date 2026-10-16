/** Initialen aus den ersten zwei Wörtern des Namens; "?" wenn leer. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (words.length === 0) return "?";
  return words.map((w) => Array.from(w)[0].toUpperCase()).join("");
}

const ROLE_LABELS: Record<string, string> = {
  GLOBAL_ADMIN: "Plattform-Admin",
  MANAGER: "Manager",
  USER: "Benutzer",
  VIEWER: "Leser",
};

/** Anzeigename einer Rolle; unbekannte Rollen bleiben unverändert. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
