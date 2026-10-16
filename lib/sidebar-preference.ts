// Anzeigepräferenz wie in DocklyBI; keine Identitäts- oder Berechtigungsquelle.
export const SIDEBAR_COOKIE = "ui_sidebar";
export const SIDEBAR_STORAGE_KEY = "sidebar-collapsed";
/** Breiten wie `--sidebar-w` und `--sidebar-rail-w` im Portal (develop 1aff3fd): Leiste 268 px, eingeklappte Rail 76 px. */
export const SIDEBAR_EXPANDED_PX = 268;
export const SIDEBAR_COLLAPSED_PX = 76;

export function readSidebarPreference(getCookie: (name: string) => string | undefined) {
  const value = getCookie(SIDEBAR_COOKIE);
  return { collapsed: value === "1", hasPreference: value === "0" || value === "1" };
}

export function readLegacySidebarPreference(): boolean | undefined {
  try {
    const value = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return value === "0" || value === "1" ? value === "1" : undefined;
  } catch {
    return undefined;
  }
}

export function writeSidebarPreference(collapsed: boolean) {
  const value = collapsed ? "1" : "0";
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${SIDEBAR_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
    // Gesperrte Cookies verhindern das Umschalten nicht.
  }
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, value);
  } catch {
    // Gesperrter Browser-Speicher verhindert das Umschalten nicht.
  }
}

/**
 * Der Server kennt alte LocalStorage-Werte nicht. Deren Breite vor dem ersten
 * Paint setzen; die Sidebar übernimmt sie bei Hydration in ihren React-State.
 * Gültige Cookies haben Vorrang. Nur die beiden festen Breiten sind zulässig.
 */
export const SIDEBAR_PREPAINT_SCRIPT = `(function(){var v;try{var m=document.cookie.match(/(?:^|;\\s*)${SIDEBAR_COOKIE}=([^;]*)/);if(m){var c=decodeURIComponent(m[1]);if(c==='0'||c==='1')v=c;}}catch(e){}if(v===undefined){try{var s=localStorage.getItem('${SIDEBAR_STORAGE_KEY}');if(s==='0'||s==='1')v=s;}catch(e){}}document.documentElement.style.setProperty('--app-sidebar-width',v==='1'?'76px':'268px');})();`;
