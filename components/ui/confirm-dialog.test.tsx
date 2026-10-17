// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/tests/helpers/intl";
import { ConfirmProvider, useConfirm, type ConfirmOptions } from "@/components/ui/confirm-dialog";

let results: boolean[] = [];

function Trigger({ opts, label = "go" }: { opts: ConfirmOptions; label?: string }) {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => {
        results.push(await confirm(opts));
      }}
    >
      {label}
    </button>
  );
}

function setup(opts: ConfirmOptions) {
  return renderWithIntl(
    <ConfirmProvider>
      <Trigger opts={opts} />
    </ConfirmProvider>,
  );
}

beforeEach(() => {
  results = [];
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConfirmDialog", () => {
  it("öffnet als alertdialog mit Titel und Beschreibung", async () => {
    setup({ title: "Wirklich löschen?", description: "Das geht nicht rückgängig." });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByText("go"));
    const dlg = await screen.findByRole("alertdialog", { name: "Wirklich löschen?" });
    expect(dlg.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Das geht nicht rückgängig.")).toBeTruthy();
  });

  it("fokussiert „Abbrechen“ beim Öffnen", async () => {
    setup({ title: "T" });
    fireEvent.click(screen.getByText("go"));
    const cancel = await screen.findByRole("button", { name: "Abbrechen" });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  });

  it("Bestätigen liefert true", async () => {
    setup({ title: "T", confirmLabel: "Löschen" });
    fireEvent.click(screen.getByText("go"));
    fireEvent.click(await screen.findByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(results).toEqual([true]));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("Standardtext des Bestätigen-Knopfs ist „Bestätigen“", async () => {
    setup({ title: "T" });
    fireEvent.click(screen.getByText("go"));
    expect(await screen.findByRole("button", { name: "Bestätigen" })).toBeTruthy();
  });

  it("Abbrechen liefert false", async () => {
    setup({ title: "T" });
    fireEvent.click(screen.getByText("go"));
    fireEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(results).toEqual([false]));
  });

  it("Escape liefert false", async () => {
    setup({ title: "T" });
    fireEvent.click(screen.getByText("go"));
    const dlg = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dlg, { key: "Escape" });
    await waitFor(() => expect(results).toEqual([false]));
  });

  it("destructive färbt den Bestätigen-Knopf als destructive", async () => {
    setup({ title: "T", confirmLabel: "Löschen", destructive: true });
    fireEvent.click(screen.getByText("go"));
    const btn = await screen.findByRole("button", { name: "Löschen" });
    expect(btn.className).toMatch(/destructive/);
  });

  it("ohne destructive kein destructive-Knopf", async () => {
    setup({ title: "T", confirmLabel: "OK" });
    fireEvent.click(screen.getByText("go"));
    const btn = await screen.findByRole("button", { name: "OK" });
    expect(btn.className).not.toMatch(/bg-destructive/);
  });

  it("gleichzeitige Aufrufe werden nacheinander abgearbeitet (zweiter wartet)", async () => {
    renderWithIntl(
      <ConfirmProvider>
        <Trigger opts={{ title: "Erste" }} label="a" />
        <Trigger opts={{ title: "Zweite" }} label="b" />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByText("a"));
    await screen.findByRole("alertdialog", { name: "Erste" });
    // Der erste Dialog ist modal; Aufruf ohne Klick über die Hook-API nachstellen.
    fireEvent.click(screen.getByText("b"), {});
    expect(screen.getByRole("alertdialog", { name: "Erste" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bestätigen" }));
    await screen.findByRole("alertdialog", { name: "Zweite" });
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(results).toEqual([true, false]));
  });

  it("useConfirm ohne Provider wirft einen klaren Fehler", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger opts={{ title: "T" }} />)).toThrow(/ConfirmProvider/);
    spy.mockRestore();
  });
});
