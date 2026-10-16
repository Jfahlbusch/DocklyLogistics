// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TenantChip } from "./tenant-chip";

afterEach(cleanup);

describe("TenantChip", () => {
  it("zeigt Initialen und Namen des Mandanten", () => {
    render(<TenantChip tenant="Bäckerei Muster" />);
    expect(screen.getByText("BM")).toBeTruthy();
    expect(screen.getByText("Bäckerei Muster")).toBeTruthy();
  });

  it("zeigt eingeklappt nur die Initialen, Name im title", () => {
    const { container } = render(<TenantChip tenant="Bäckerei Muster" collapsed />);
    expect(screen.getByText("BM")).toBeTruthy();
    expect(screen.queryByText("Bäckerei Muster")).toBeNull();
    expect(container.querySelector('[title="Bäckerei Muster"]')).not.toBeNull();
  });
});
