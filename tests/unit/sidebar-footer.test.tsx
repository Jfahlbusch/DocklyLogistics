// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import de from "../../messages/de.json";
import { SidebarFooter } from "@/components/layout/sidebar-footer";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";

vi.mock("@/components/layout/profile-actions", () => ({ logoutAction: vi.fn() }));
afterEach(cleanup);

function wrap(node: React.ReactNode) {
  return render(<NextIntlClientProvider locale="de" messages={de}>{node}</NextIntlClientProvider>);
}
const base = { userName: "Max Muster", userEmail: "max@example.test", role: "MANAGER" as const, subtitle: "Beispiel GmbH" };

// Menü-Fuß im Portal-Aufbau (`.sidebar-footer` > `.sidebar-user`): Benutzer-Symbol, Name, Unternehmen, drei Symbolknöpfe.
describe("Menü-Fuß: Profilzeile", () => {
  it("zeigt Namen und Unternehmen und stellt Trennlinie sowie Innenabstand des Portals ein", () => {
    const { container } = wrap(<SidebarFooter {...base} />);
    expect(container.firstElementChild).toHaveClass("mt-auto", "border-t", "border-sidebar-border", "py-[0.9rem]", "px-[0.7rem]");
    expect(container).toHaveTextContent("Max Muster");
    expect(container).toHaveTextContent("Beispiel GmbH");
  });
  it("bietet Farbschema, Benutzermenü und Abmelden als Symbolknöpfe in dieser Reihenfolge", () => {
    wrap(<SidebarFooter {...base} />);
    const names = screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual([de.shell.theme.label, de.shell.user.openMenu, de.shell.signOut]);
  });
  it("gibt den Symbolknöpfen 32 px, mobil und bei Touch 44 px; der Farbschema-Knopf liegt unter 992 px in der Kopfleiste", () => {
    wrap(<SidebarFooter {...base} />);
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("size-8");
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("max-nav:size-11");
    for (const button of screen.getAllByRole("button")) expect(button.className).toContain("pointer-coarse:size-11");
    expect(screen.getByRole("button", { name: de.shell.theme.label })).toHaveClass("max-nav:hidden");
  });
  it("stapelt eingeklappt die Symbolknöpfe untereinander und blendet Namen und Symbol aus", () => {
    const { container } = wrap(<SidebarFooter {...base} collapsed />);
    expect(container.firstElementChild).toHaveClass("px-3");
    expect(container).not.toHaveTextContent("Max Muster");
    expect(screen.getByRole("button", { name: de.shell.signOut }).closest("span")).toHaveClass("flex-col");
  });
  it("öffnet das Benutzermenü mit E-Mail, Rolle und Sprache; Abmelden steht außerhalb", () => {
    wrap(<SidebarFooter {...base} />);
    fireEvent.click(screen.getByRole("button", { name: de.shell.user.openMenu }));
    const menu = screen.getByRole("dialog", { name: de.shell.user.openMenu });
    expect(menu).toHaveTextContent("max@example.test");
    expect(menu).toHaveTextContent(de.shell.user.roles.MANAGER);
    expect(menu).not.toHaveTextContent(de.shell.signOut);
  });
  it("öffnet das Farbschema als Auswahl aus Hell, Dunkel und System", () => {
    wrap(<SidebarFooter {...base} />);
    fireEvent.click(screen.getByRole("button", { name: de.shell.theme.label }));
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });
});

describe("Einklapp-Knopf auf der Kante", () => {
  it("wechselt Beschriftung und schaltet um", () => {
    const onToggle = vi.fn();
    const view = wrap(<SidebarToggle collapsed={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: de.shell.sidebar.collapseMenu }));
    expect(onToggle).toHaveBeenCalledOnce();
    view.rerender(<NextIntlClientProvider locale="de" messages={de}><SidebarToggle collapsed onToggle={onToggle} /></NextIntlClientProvider>);
    expect(screen.getByRole("button", { name: de.shell.sidebar.expandMenu }).querySelector("svg")).toHaveClass("rotate-180");
  });
  it("macht den Knopf bei Touch-Bedienung 44 px groß", () => {
    wrap(<SidebarToggle collapsed={false} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: de.shell.sidebar.collapseMenu }).className).toContain("pointer-coarse:size-11");
  });
});
