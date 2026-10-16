// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import de from "../../messages/de.json";
// Nur Deutsch (PLAN.md N8): Die englischen Fälle der Vorlage laufen mit den deutschen Texten.
const en = de;
import { SidebarUser } from "@/components/layout/sidebar-user";

vi.mock("@/components/layout/profile-actions", () => ({ logoutAction: vi.fn() }));
afterEach(cleanup);

type Props = Partial<React.ComponentProps<typeof SidebarUser>>;
function show(props: Props = {}, locale: "de" = "de") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "de" ? de : en}>
      <SidebarUser userName="Jonathan Fahlbusch" userEmail="jf@example.test" role="GLOBAL_ADMIN" subtitle="Beispiel GmbH" {...props} />
    </NextIntlClientProvider>,
  );
}

// Profilzeile im Portal-Aufbau (Symbol, Name, Unternehmen, Symbolknöpfe); das Benutzermenü öffnet der Zahnrad-Knopf.
describe("Profilzeile am Fuß des Menüs", () => {
  it("zeigt Namen und Unternehmen, ohne Initialen-Kachel und ohne Rollen-Badge in der Zeile", () => {
    const { container } = show();
    expect(container).toHaveTextContent("Jonathan Fahlbusch");
    expect(container).toHaveTextContent("Beispiel GmbH");
    expect(container).not.toHaveTextContent("JF");
    expect(container).not.toHaveTextContent(de.shell.user.roles.GLOBAL_ADMIN);
  });
  it("setzt Name auf 16 px / 600 und Unternehmen auf 12,8 px (nie unter 12 px)", () => {
    show();
    expect(screen.getByText("Jonathan Fahlbusch")).toHaveClass("text-base", "font-semibold", "truncate");
    expect(screen.getByText("Beispiel GmbH")).toHaveClass("text-[0.8rem]", "truncate");
  });
  it("fällt ohne Unternehmen auf die E-Mail-Adresse zurück und übersetzt die Rolle im Benutzermenü", () => {
    show({ subtitle: undefined, role: "VIEWER" });
    expect(screen.getByText("jf@example.test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.shell.user.openMenu }));
    expect(screen.getByRole("dialog")).toHaveTextContent(en.shell.user.roles.VIEWER);
  });
  it("öffnet das Benutzermenü mit E-Mail (ohne Sprache, PLAN.md N8); Abmelden ist ein eigener Symbolknopf", () => {
    show();
    expect(screen.getByRole("button", { name: de.shell.signOut })).toHaveAttribute("type", "submit");
    fireEvent.click(screen.getByRole("button", { name: de.shell.user.openMenu }));
    const menu = screen.getByRole("dialog");
    expect(menu).toHaveTextContent("jf@example.test");
    expect(menu).not.toHaveTextContent("Sprache");
  });
  it("zeigt eingeklappt nur die Symbolknöpfe, das Menü bleibt erreichbar", () => {
    const { container } = show({ collapsed: true });
    expect(container).not.toHaveTextContent("Jonathan Fahlbusch");
    fireEvent.click(screen.getByRole("button", { name: de.shell.user.openMenu }));
    expect(screen.getByRole("dialog")).toHaveTextContent("jf@example.test");
  });
  it("trägt 32-px-Knöpfe (mobil 44 px) und keine Startkante", () => {
    show();
    for (const name of [de.shell.user.openMenu, de.shell.signOut, de.shell.theme.label]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("size-8");
      expect(button.className).toContain("max-nav:size-11");
      expect(button.className).not.toMatch(/border-(?:l|s)-|inset|before:|after:/);
    }
  });
});
