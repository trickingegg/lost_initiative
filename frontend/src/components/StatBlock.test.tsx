import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatBlock from "./StatBlock";

describe("StatBlock", () => {
  it("renders label, score, and positive modifier", () => {
    render(<StatBlock label="STR" score={16} modifier={3} />);
    expect(screen.getByText("STR")).toBeDefined();
    expect(screen.getByText("16")).toBeDefined();
    expect(screen.getByText("+3")).toBeDefined();
  });

  it("renders negative modifier", () => {
    render(<StatBlock label="INT" score={8} modifier={-1} />);
    expect(screen.getByText("-1")).toBeDefined();
  });

  it("renders zero modifier without sign", () => {
    render(<StatBlock label="WIS" score={10} modifier={0} />);
    expect(screen.getByText("+0")).toBeDefined();
  });
});
