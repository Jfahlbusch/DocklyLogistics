// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIDEBAR_GAP_PX, SIDEBAR_RADIUS_PX, SIDEBAR_SHELL_CLASS, sidebarSpacePx } from "@/lib/sidebar-geometry";
import { SIDEBAR_COLLAPSED_PX, SIDEBAR_EXPANDED_PX, SIDEBAR_PREPAINT_SCRIPT } from "@/lib/sidebar-preference";

// Maße aus dem Portal (develop 1aff3fd, `_app_shell.scss`): `--sidebar-w` 268 px, `--sidebar-rail-w` 76 px, `--sidebar-gap` 0.75rem,
// Radius `$border-radius-lg` 26 px (`_settings.scss`), Breakpoint Bootstrap `lg` 992 px.
const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

describe("Geometrie des Seitenmenüs", () => {
  it("übernimmt Breite, Rail, Abstand und Radius des Portals", () => {
    expect([SIDEBAR_EXPANDED_PX, SIDEBAR_COLLAPSED_PX, SIDEBAR_GAP_PX, SIDEBAR_RADIUS_PX]).toEqual([268, 76, 12, 26]);
  });
  it("belegt im Seitengefüge Breite plus Abstand links und rechts (Portal: margin-inline-start = sidebar-w + 2 × gap)", () => {
    expect(sidebarSpacePx(false)).toBe(268 + 24);
    expect(sidebarSpacePx(true)).toBe(76 + 24);
  });
  it("rundet den Rahmen und umgibt ihn mit gleichmäßigem Rand und dem Panel-Schatten", () => {
    expect(SIDEBAR_SHELL_CLASS).toContain(`rounded-[${SIDEBAR_RADIUS_PX}px]`);
    expect(SIDEBAR_SHELL_CLASS).toMatch(/(?:^|\s)border(?:\s|$)/);
    expect(SIDEBAR_SHELL_CLASS).toContain("sidebar-panel");
    expect(css).toMatch(/\.sidebar-panel\s*\{[^}]*box-shadow:\s*0 0\.5rem 1rem/);
  });
  it("setzt den Breakpoint des Menüs auf 62 rem = 992 px (Bootstrap lg), nicht auf Tailwind lg (1024 px)", () => {
    expect(css).toMatch(/--breakpoint-nav:\s*62rem;/);
    expect(62 * 16).toBe(992);
  });
  it("hält die Dichte-Varianten short (≤ 900 px) und tiny (≤ 400 px) und kennt kein `low` mehr", () => {
    expect(css).toContain("@custom-variant short (@media (max-height: 900px));");
    expect(css).toContain("@custom-variant tiny (@media (max-height: 400px));");
    expect(css).not.toContain("@custom-variant low");
  });
  it("setzt die Vor-Paint-Breite auf die Portal-Breiten", () => {
    expect(SIDEBAR_PREPAINT_SCRIPT).toContain("'76px':'268px'");
  });
});
