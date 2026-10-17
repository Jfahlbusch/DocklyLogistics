import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CHECKBOX_CLASS, CHECK_LABEL_CLASS, CHIP_CLASS, NATIVE_SELECT_CLASS, NATIVE_TEXTAREA_CLASS, NATIVE_TEXTAREA_MONO_CLASS } from "./native-field";

// B10 (Tablets): Ab 768 px galten bisher die kompakten Desktop-Größen — auf einem iPad (grobe Zeigersteuerung) hieß das 14-px-Selects
// (iOS zoomt beim Fokus) und 25-px-Tabs. Kompakt wird es ab `md` nur noch bei feiner Zeigersteuerung (`md:pointer-fine:`).
const read = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");

describe("Touch-Tablets behalten Touch-Größen", () => {
  it.each([
    ["NATIVE_SELECT_CLASS", NATIVE_SELECT_CLASS],
    ["NATIVE_TEXTAREA_CLASS", NATIVE_TEXTAREA_CLASS],
    ["NATIVE_TEXTAREA_MONO_CLASS", NATIVE_TEXTAREA_MONO_CLASS],
    ["CHECKBOX_CLASS", CHECKBOX_CLASS],
    ["CHECK_LABEL_CLASS", CHECK_LABEL_CLASS],
    ["CHIP_CLASS", CHIP_CLASS],
  ])("%s verkleinert erst bei md + feiner Zeigersteuerung", (_name, cls) => {
    expect(cls).not.toMatch(/(^|\s)md:(text-|min-h-|size-|px-|py-)/);
    expect(cls).toMatch(/md:pointer-fine:/);
  });

  it("Input verkleinert Höhe und Schrift erst bei md + feiner Zeigersteuerung", () => {
    const src = read("input.tsx");
    expect(src).not.toMatch(/(^|\s|")md:(h-|text-)/);
    expect(src).toMatch(/md:pointer-fine:h-8/);
    expect(src).toMatch(/md:pointer-fine:text-sm/);
  });

  it("Tabs: feste 32-px-Leiste und kleine Trigger nur bei md + feiner Zeigersteuerung", () => {
    const src = read("tabs.tsx");
    expect(src).not.toMatch(/(^|\s)group-data-horizontal\/tabs:h-8/);
    expect(src).toMatch(/md:pointer-fine:group-data-horizontal\/tabs:h-8/);
    expect(src).toMatch(/pointer-coarse:min-h-11/);
  });
});
