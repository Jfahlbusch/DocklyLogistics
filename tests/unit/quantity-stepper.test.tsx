// @vitest-environment jsdom
import { useState } from "react";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { QuantityStepper } from "@/components/warehouse/quantity-stepper";

afterEach(cleanup);

type Over = Partial<React.ComponentProps<typeof QuantityStepper>>;

function Harness({ initial = 0, ...rest }: Over & { initial?: number }) {
  const [v, setV] = useState(initial);
  return (
    <QuantityStepper
      value={v}
      onChange={setV}
      orderUnitLabel="Karton"
      baseUnitLabel="Stück"
      packFactor={25}
      stockTotal={120}
      maxStock={500}
      {...rest}
    />
  );
}

const input = () => screen.getByLabelText("Bestellmenge") as HTMLInputElement;

describe("QuantityStepper", () => {
  it("+ und − ändern um 1", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness initial={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Menge erhöhen" }));
    expect(onChange).toHaveBeenLastCalledWith(6);
    fireEvent.click(screen.getByRole("button", { name: "Menge verringern" }));
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("− ist bei 0 deaktiviert", () => {
    renderWithIntl(<Harness initial={0} />);
    expect((screen.getByRole("button", { name: "Menge verringern" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Tippen von 12 setzt 12; Buchstaben werden ignoriert", () => {
    renderWithIntl(<Harness initial={0} />);
    fireEvent.change(input(), { target: { value: "12" } });
    expect(input().value).toBe("12");
    fireEvent.change(input(), { target: { value: "12a" } });
    expect(input().value).toBe("12");
    fireEvent.change(input(), { target: { value: "a" } });
    expect(input().value).toBe("");
  });

  it("leeres Feld wird beim Verlassen zu 0", () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness initial={3} onChange={onChange} />);
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(input().value).toBe("0");
  });

  it("Input hat numerische Tastatur-Attribute", () => {
    renderWithIntl(<Harness />);
    expect(input().getAttribute("inputmode")).toBe("numeric");
    expect(input().getAttribute("pattern")).toBe("[0-9]*");
  });

  it("Warnung genau bei 120 + 16×25 > 500", () => {
    renderWithIntl(<Harness initial={15} />);
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    renderWithIntl(<Harness initial={16} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("ohne maxStock keine Warnung und kein „frei bis“-Text", () => {
    renderWithIntl(<Harness initial={999} maxStock={null} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/frei bis/i)).toBeNull();
  });

  it("zeigt Umrechnung und freie Kapazität", () => {
    renderWithIntl(<Harness initial={4} />);
    expect(screen.getByText("= 100 Stück")).toBeTruthy();
    expect(screen.getByText(/frei bis Kapazität: 380 Stück/)).toBeTruthy();
  });

  it("Knöpfe sind mindestens 64 px groß", () => {
    renderWithIntl(<Harness />);
    for (const name of ["Menge erhöhen", "Menge verringern"]) {
      const cls = screen.getByRole("button", { name }).className;
      expect(cls).toContain("size-16");
    }
  });

  it("disabled sperrt alles", () => {
    renderWithIntl(<Harness initial={2} disabled />);
    expect(input().disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Menge erhöhen" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
