import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StoryLog from "./StoryLog";
import type { ChatMessage } from "@/types/domain";

const messages: ChatMessage[] = [
  { role: "player", content: "I attack the goblin." },
  { role: "gm", content: "You swing your sword mightily." },
  { role: "system", content: "The battle has started." },
];

describe("StoryLog", () => {
  it("renders player message with prefix", () => {
    render(<StoryLog messages={messages} />);
    expect(screen.getByText(/> I attack the goblin./)).toBeDefined();
  });

  it("renders gm message", () => {
    render(<StoryLog messages={messages} />);
    expect(screen.getByText("You swing your sword mightily.")).toBeDefined();
  });

  it("renders system message", () => {
    render(<StoryLog messages={messages} />);
    expect(screen.getByText("The battle has started.")).toBeDefined();
  });

  it("renders streaming text with pulse", () => {
    const { container } = render(
      <StoryLog messages={[]} streamingText="The dragon..." />
    );
    const pulse = container.querySelector(".animate-pulse");
    expect(pulse).toBeDefined();
    expect(screen.getByText("The dragon...")).toBeDefined();
  });

  it("renders empty state", () => {
    render(<StoryLog messages={[]} />);
    expect(screen.queryByText(/>/)).toBeNull();
  });
});
