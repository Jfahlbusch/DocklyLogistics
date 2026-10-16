import { describe, expect, it } from "vitest";
import { initials, roleLabel } from "@/lib/user-display";

describe("initials", () => {
  it("nimmt die ersten Buchstaben der ersten zwei Wörter", () => {
    expect(initials("Jonathan Fahlbusch")).toBe("JF");
    expect(initials("max mustermann meier")).toBe("MM");
  });

  it("funktioniert mit einem Wort", () => {
    expect(initials("anna")).toBe("A");
  });

  it("liefert ? bei leer oder nur Leerzeichen", () => {
    expect(initials("")).toBe("?");
    expect(initials("  ")).toBe("?");
  });

  it("behandelt mehrfache Leerzeichen", () => {
    expect(initials("  anna   berta ")).toBe("AB");
  });

  it("liefert bei E-Mail nur den ersten Buchstaben", () => {
    expect(initials("j.f@x.de")).toBe("J");
  });
});

describe("roleLabel", () => {
  it("übersetzt bekannte Rollen", () => {
    expect(roleLabel("GLOBAL_ADMIN")).toBe("Plattform-Admin");
    expect(roleLabel("MANAGER")).toBe("Manager");
    expect(roleLabel("USER")).toBe("Benutzer");
    expect(roleLabel("VIEWER")).toBe("Leser");
  });

  it("gibt unbekannte Rollen unverändert zurück", () => {
    expect(roleLabel("SOMETHING")).toBe("SOMETHING");
  });
});
