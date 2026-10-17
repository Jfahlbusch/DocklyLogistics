// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let desktop = true;
vi.mock("@/hooks/use-media-query", () => ({
  MD_QUERY: "(min-width: 768px)",
  useMediaQuery: () => desktop,
}));

import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

afterEach(cleanup);
beforeEach(() => {
  desktop = true;
});

function Demo({ size }: { size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <ResponsiveDialog open onOpenChange={() => {}}>
      <ResponsiveDialogContent size={size}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Titel</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Beschreibung</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>Inhalt</ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <button>Abbrechen</button>
          <button>Speichern</button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

describe("ResponsiveDialog", () => {
  it("rendert ab md einen zentrierten Dialog mit Titel und Footer", () => {
    render(<Demo size="lg" />);
    const d = screen.getByRole("dialog");
    expect(d).toHaveAttribute("data-slot", "dialog-content");
    expect(d).toHaveClass("sm:max-w-2xl");
    expect(screen.getByRole("heading", { name: "Titel" })).toBeInTheDocument();
    expect(screen.getByText("Abbrechen").parentElement).toHaveClass("sticky", "bottom-0");
  });

  it("rendert unter md ein Bottom-Sheet mit Griff, Titel und sticky Footer", () => {
    desktop = false;
    render(<Demo />);
    const d = screen.getByRole("dialog");
    expect(d).toHaveAttribute("data-slot", "sheet-content");
    expect(d).toHaveAttribute("data-side", "bottom");
    expect(d.querySelector("[data-slot='responsive-dialog-handle']")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Titel" })).toBeInTheDocument();
    const footer = screen.getByText("Speichern").parentElement!;
    expect(footer).toHaveClass("sticky", "bottom-0", "max-md:flex-col");
  });

  it("Body scrollt", () => {
    render(<Demo />);
    expect(screen.getByText("Inhalt")).toHaveClass("overflow-y-auto");
  });

  it("Schließen-Knopf ist mobil mindestens 44 px", () => {
    desktop = false;
    render(<Demo />);
    const close = screen.getByRole("button", { name: /schließen/i });
    expect(close).toHaveClass("max-md:size-11");
  });
});
