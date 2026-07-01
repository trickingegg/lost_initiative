import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import HealthBar from "./HealthBar";

describe("HealthBar", () => {
  it("renders current/max text", () => {
    render(<HealthBar current={15} max={30} />);
    expect(screen.getByText("15 / 30")).toBeDefined();
  });

  it("renders green bar when HP >= 50%", () => {
    const { container } = render(<HealthBar current={20} max={30} />);
    const bar = container.querySelector(".bg-green-500");
    expect(bar).toBeDefined();
  });

  it("renders yellow bar when HP >= 25% and < 50%", () => {
    const { container } = render(<HealthBar current={12} max={30} />);
    const bar = container.querySelector(".bg-yellow-500");
    expect(bar).toBeDefined();
  });

  it("renders red bar when HP < 25%", () => {
    const { container } = render(<HealthBar current={5} max={30} />);
    const bar = container.querySelector(".bg-red-500");
    expect(bar).toBeDefined();
  });

  it("handles zero max HP gracefully", () => {
    render(<HealthBar current={0} max={0} />);
    expect(screen.getByText("0 / 0")).toBeDefined();
  });
});
