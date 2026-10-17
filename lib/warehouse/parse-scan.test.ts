import { describe, it, expect } from "vitest";
import { parseScan } from "./parse-scan";

const ORIGIN = "https://logistics.dockly.de";

describe("parseScan", () => {
  it("erkennt die eigene Rundgang-URL als Zone", () => {
    expect(parseScan(`${ORIGIN}/warehouse-mode?zone=abc_12-X`, ORIGIN)).toEqual({ kind: "zone", zoneId: "abc_12-X" });
  });

  it("erlaubt einen abschließenden Slash", () => {
    expect(parseScan(`${ORIGIN}/warehouse-mode/?zone=z1`, ORIGIN)).toEqual({ kind: "zone", zoneId: "z1" });
  });

  it("trimmt Leerraum um die URL und um Codes", () => {
    expect(parseScan(`  ${ORIGIN}/warehouse-mode?zone=z1\n`, ORIGIN)).toEqual({ kind: "zone", zoneId: "z1" });
    expect(parseScan("  VP-BTUE-1000 \t", ORIGIN)).toEqual({ kind: "code", code: "VP-BTUE-1000" });
  });

  it("lässt zusätzliche Parameter oder Hash zu", () => {
    expect(parseScan(`${ORIGIN}/warehouse-mode?zone=z1&i=3#x`, ORIGIN)).toEqual({ kind: "zone", zoneId: "z1" });
  });

  it.each([
    ["fremder Host", "https://evil.example/warehouse-mode?zone=X"],
    ["Subdomain-Trick", "https://logistics.dockly.de.evil.example/warehouse-mode?zone=X"],
    ["Userinfo-Trick", "https://logistics.dockly.de@evil.example/warehouse-mode?zone=X"],
    ["anderes Schema", "http://logistics.dockly.de/warehouse-mode?zone=X"],
    ["anderer Port", "https://logistics.dockly.de:8443/warehouse-mode?zone=X"],
    ["relativer Pfad", "/warehouse-mode?zone=X"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["anderer Pfad", `${ORIGIN}/orders?zone=X`],
    ["Unterpfad", `${ORIGIN}/warehouse-mode/x?zone=X`],
    ["ohne zone", `${ORIGIN}/warehouse-mode`],
    ["leere zone", `${ORIGIN}/warehouse-mode?zone=`],
    ["ungültige zone ../x", `${ORIGIN}/warehouse-mode?zone=../x`],
    ["zone mit Leerzeichen", `${ORIGIN}/warehouse-mode?zone=a%20b`],
    ["zone zu lang", `${ORIGIN}/warehouse-mode?zone=${"a".repeat(65)}`],
    ["kaputte URL", "https://"],
  ])("behandelt %s als Code", (_name, raw) => {
    expect(parseScan(raw, ORIGIN)).toEqual({ kind: "code", code: raw.trim() });
  });

  it("akzeptiert genau 64 Zeichen", () => {
    const id = "a".repeat(64);
    expect(parseScan(`${ORIGIN}/warehouse-mode?zone=${id}`, ORIGIN)).toEqual({ kind: "zone", zoneId: id });
  });

  it("behandelt normale SKUs und EANs als Code", () => {
    expect(parseScan("VP-BTUE-1000", ORIGIN)).toEqual({ kind: "code", code: "VP-BTUE-1000" });
    expect(parseScan("4006381333931", ORIGIN)).toEqual({ kind: "code", code: "4006381333931" });
  });

  it("verträgt einen ungültigen currentOrigin ohne zu werfen", () => {
    expect(parseScan(`${ORIGIN}/warehouse-mode?zone=z1`, "")).toEqual({ kind: "code", code: `${ORIGIN}/warehouse-mode?zone=z1` });
  });
});
