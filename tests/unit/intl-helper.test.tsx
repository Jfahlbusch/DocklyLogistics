// @vitest-environment jsdom
import { screen, cleanup } from "@testing-library/react";
import { useTranslations } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import de from "../../messages/de.json";

afterEach(cleanup);

function Probe() {
  const t = useTranslations();
  return (
    <p>
      {t("nav.areas.purchasing")} / {t("shell.mainNavigation")}
    </p>
  );
}

describe("next-intl ohne URL-Sprache", () => {
  it("renderWithIntl liefert die deutschen Texte aus messages/de.json", () => {
    renderWithIntl(<Probe />);
    expect(screen.getByText("Einkauf / Hauptnavigation")).toBeTruthy();
  });

  it("routing kennt nur Deutsch", () => {
    expect(routing.locales).toEqual(["de"]);
    expect(routing.defaultLocale).toBe("de");
  });

  it("getPathname setzt kein Sprachpräfix", () => {
    expect(getPathname({ href: "/orders", locale: "de" })).toBe("/orders");
  });

  it("de.json hat die Namespaces articles, common, nav, shell, warehouse und zones", () => {
    expect(Object.keys(de).sort()).toEqual(["articles", "common", "nav", "shell", "warehouse", "zones"]);
  });
});
