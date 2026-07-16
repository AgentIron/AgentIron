import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { createSignal, type Component } from "solid-js";

describe("test infrastructure smoke test", () => {
  it("renders a Solid component", () => {
    const TestComponent: Component = () => <p data-testid="hello">Hello</p>;
    const { getByTestId } = render(() => <TestComponent />);
    expect(getByTestId("hello").textContent).toBe("Hello");
  });

  it("handles user interaction", async () => {
    const TestComponent: Component = () => {
      const [count, setCount] = createSignal(0);
      return (
        <button data-testid="btn" onClick={() => setCount(count() + 1)}>
          Count: {count()}
        </button>
      );
    };
    const { getByTestId } = render(() => <TestComponent />);
    const btn = getByTestId("btn");
    expect(btn.textContent).toBe("Count: 0");
    fireEvent.click(btn);
    expect(btn.textContent).toBe("Count: 1");
  });

  it("mocks Tauri invoke", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue("ok");
    const result = await invoke("test_command");
    expect(result).toBe("ok");
    expect(invoke).toHaveBeenCalledWith("test_command");
  });
});
