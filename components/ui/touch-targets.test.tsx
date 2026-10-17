// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailField } from "@/components/ui/detail-field";
import {
  CHECKBOX_CLASS,
  CHECK_LABEL_CLASS,
  CHIP_CLASS,
  NATIVE_SELECT_CLASS,
  NATIVE_TEXTAREA_CLASS,
  NATIVE_TEXTAREA_MONO_CLASS,
} from "@/components/ui/native-field";

afterEach(cleanup);

describe("Button: 44-px-Touch-Ziel", () => {
  it.each(["default", "xs", "sm", "lg"] as const)("Text-Größe %s hat min-h-11 unter md und bei grobem Zeiger", (size) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole("button")).toHaveClass("max-md:min-h-11", "pointer-coarse:min-h-11");
  });

  it.each(["icon", "icon-xs", "icon-sm", "icon-lg"] as const)("Icon-Größe %s ist 44 px unter md und bei grobem Zeiger", (size) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole("button")).toHaveClass("max-md:size-11", "pointer-coarse:size-11");
  });

  it("Mindestmaß überlebt typische className-Overrides", () => {
    render(<Button className="h-8 h-7 size-7 px-2">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("max-md:min-h-11", "pointer-coarse:min-h-11");
    cleanup();
    render(<Button size="icon" className="size-6">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("max-md:size-11", "pointer-coarse:size-11");
  });
});

describe("Input", () => {
  it("ist mobil 44 px hoch und bleibt text-base; Desktop unverändert", () => {
    render(<Input aria-label="a" />);
    const el = screen.getByLabelText("a");
    expect(el).toHaveClass("h-11", "text-base", "md:pointer-fine:h-8", "md:pointer-fine:text-sm");
  });
});

describe("Tabs", () => {
  it("TabsList scrollt seitwärts ohne Seiten-Überlauf; Trigger sind touch-groß und schrumpfen nicht", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByRole("tablist")).toHaveClass("max-w-full", "overflow-x-auto");
    expect(screen.getByRole("tab", { name: "A" })).toHaveClass("max-md:min-h-11", "shrink-0");
  });

  it("scrollt den aktiven Tab beim Wechsel ins Bild", async () => {
    const calls: unknown[] = [];
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
      calls.push([this.getAttribute("data-state"), arg]);
    };
    try {
      const { rerender } = render(
        <Tabs value="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
        </Tabs>,
      );
      calls.length = 0;
      rerender(
        <Tabs value="b">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
        </Tabs>,
      );
      await waitFor(() => expect(calls).toContainEqual(["active", { block: "nearest", inline: "nearest" }]));
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });
});

describe("native-field-Konstanten", () => {
  it("Select/Textarea: text-base mobil, md:pointer-fine:text-sm, 44 px", () => {
    for (const c of [NATIVE_SELECT_CLASS, NATIVE_TEXTAREA_CLASS]) {
      expect(c).toContain("text-base");
      expect(c).toContain("md:pointer-fine:text-sm");
    }
    expect(NATIVE_SELECT_CLASS).toContain("min-h-11");
    expect(NATIVE_SELECT_CLASS).toContain("md:pointer-fine:min-h-9");
  });
  it("Mono-Textarea", () => {
    expect(NATIVE_TEXTAREA_MONO_CLASS).toContain("font-mono");
    expect(NATIVE_TEXTAREA_MONO_CLASS).toContain("text-base");
    expect(NATIVE_TEXTAREA_MONO_CLASS).toContain("md:pointer-fine:text-xs");
  });
  it("Checkbox, Label, Chip", () => {
    expect(CHECKBOX_CLASS).toBe("size-5 md:pointer-fine:size-4");
    expect(CHECK_LABEL_CLASS).toBe("flex min-h-11 items-center gap-3 md:pointer-fine:min-h-0");
    expect(CHIP_CLASS).toContain("min-h-11");
    expect(CHIP_CLASS).toContain("md:pointer-fine:min-h-0");
  });
});

describe("DetailField", () => {
  it("Label über Wert mobil, nebeneinander ab sm; Wert umbricht", () => {
    const { container } = render(<DetailField label="EAN" value="123" />);
    const row = container.firstElementChild!;
    expect(row).toHaveClass("flex-col", "sm:flex-row");
    const label = row.children[0];
    expect(label).toHaveClass("sm:w-44");
    expect(label).not.toHaveClass("w-44");
    expect(row.children[1]).toHaveClass("min-w-0", "break-words");
  });
  it("Mono-Werte brechen überall", () => {
    const { container } = render(<DetailField label="SKU" value="x" mono />);
    expect(container.firstElementChild!.children[1]).toHaveClass("font-mono", "break-all", "min-w-0");
  });
});
