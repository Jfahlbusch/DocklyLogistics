// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { Brand } from "@/components/layout/brand";

afterEach(cleanup);

describe("Brand (Menükopf)", () => {
  it("setzt den Schriftzug einzeilig auf 16 px, damit „dockly LOGISTICS“ in Leiste und Drawer passt", () => {
    renderWithIntl(<Brand />);
    const word = screen.getByText("LOGISTICS").parentElement;
    expect(word).toHaveClass("text-base", "whitespace-nowrap");
  });

  it("lässt im Drawer rechts Platz für den Schließen-Knopf und zeigt eingeklappt nur die Marke", () => {
    const { container, rerender } = renderWithIntl(<Brand />);
    expect(container.firstElementChild).toHaveClass("max-nav:pe-14", "max-nav:ps-4");
    rerender(<Brand collapsed />);
    expect(screen.queryByText("LOGISTICS")).not.toBeInTheDocument();
  });
});
