// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

afterEach(cleanup);

// Regression: Hohe Dialoge (Artikel bearbeiten mit Mengen und Zone) ragten über den Bildschirm hinaus —
// „Speichern“ war nicht erreichbar. Der Dialog ist an die Displayhöhe gebunden und scrollt selbst.
describe("DialogContent", () => {
  it("ist höchstens Displayhöhe minus Rand hoch und scrollt seinen Inhalt", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Test</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-h-[calc(100dvh-2rem)]", "overflow-y-auto", "overscroll-contain");
  });
});

describe("DialogContent Schließen-Knopf", () => {
  it("ist mobil 44 px groß", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Test</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("button", { name: /close|schließen/i })).toHaveClass("max-md:size-11");
  });
});
