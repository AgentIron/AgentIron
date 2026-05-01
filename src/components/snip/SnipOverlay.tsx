import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  TbOutlineScreenshot,
  TbOutlineClock,
  TbOutlineX,
} from "solid-icons/tb";

type Phase = "widget" | "countdown" | "capturing" | "selection";

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SnipOverlay = () => {
  const [phase, setPhase] = createSignal<Phase>("widget");
  const [countdown, setCountdown] = createSignal(3);
  const [imageDataUri, setImageDataUri] = createSignal("");
  const [imageLoaded, setImageLoaded] = createSignal(false);
  const [selection, setSelection] = createSignal<SelectionRect | null>(null);
  const [isDragging, setIsDragging] = createSignal(false);
  const [startPos, setStartPos] = createSignal({ x: 0, y: 0 });

  // Suppress scrollbars on the document itself
  onMount(() => {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
  });

  // Listen for the capture-complete event from Rust
  onMount(async () => {
    const unlisten = await listen("snip-captured", async () => {
      try {
        const base64: string = await invoke("get_snip_screenshot");
        setImageDataUri(`data:image/png;base64,${base64}`);
        setPhase("selection");
      } catch (err) {
        console.error("Failed to load screenshot:", err);
        await invoke("cancel_snip");
      }
    });
    onCleanup(() => unlisten());
  });

  // Keyboard
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      invoke("cancel_snip");
    }
  };
  onMount(() => window.addEventListener("keydown", handleKeyDown));
  onCleanup(() => window.removeEventListener("keydown", handleKeyDown));

  // ── Widget actions ──

  const captureNow = async () => {
    setPhase("capturing");
    try {
      // Rust will hide the window, wait, capture, then show+resize for selection
      await invoke("capture_snip");
    } catch (err) {
      console.error("Capture failed:", err);
    }
  };

  const captureWithDelay = () => {
    setPhase("countdown");
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          captureNow();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const cancel = () => {
    invoke("cancel_snip");
  };

  // ── Selection mouse events ──

  const handleMouseDown = (e: MouseEvent) => {
    if (phase() !== "selection") return;
    e.preventDefault();
    setStartPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    setSelection(null);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;
    const start = startPos();
    const x = Math.min(start.x, e.clientX);
    const y = Math.min(start.y, e.clientY);
    const width = Math.abs(e.clientX - start.x);
    const height = Math.abs(e.clientY - start.y);
    setSelection({ x, y, width, height });
  };

  const handleMouseUp = async () => {
    if (!isDragging()) return;
    setIsDragging(false);

    const sel = selection();
    if (!sel || sel.width < 5 || sel.height < 5) {
      await invoke("cancel_snip");
      return;
    }

    try {
      const scaleFactor = await getCurrentWindow().scaleFactor();
      await invoke("complete_snip", {
        region: {
          x: sel.x,
          y: sel.y,
          width: sel.width,
          height: sel.height,
          scaleFactor,
        },
      });
    } catch (err) {
      console.error("Failed to complete snip:", err);
      await invoke("cancel_snip");
    }
  };

  const clipPath = () => {
    const sel = selection();
    if (!sel) return undefined;
    const { x, y, width, height } = sel;
    const r = x + width;
    const b = y + height;
    return `polygon(
      0% 0%, 0% 100%,
      ${x}px 100%, ${x}px ${y}px,
      ${r}px ${y}px, ${r}px ${b}px,
      ${x}px ${b}px, ${x}px 100%,
      100% 100%, 100% 0%
    )`;
  };

  // ── Render ──

  return (
    <>
      {/* Phase 1: Widget */}
      <Show when={phase() === "widget"}>
        <div class="w-screen h-screen overflow-hidden flex items-center justify-center bg-bg-secondary font-sans text-white">
          <div class="flex flex-col items-center gap-3">
            <div class="text-xs text-text-secondary">
              Arrange your screen, then capture
            </div>
            <div class="flex gap-1.5">
              <button
                onClick={captureNow}
                class="flex items-center gap-1 px-3.5 py-1.5 rounded-md border-none bg-accent text-void text-xs cursor-pointer hover:bg-accent-hover"
              >
                <TbOutlineScreenshot size={14} />
                Capture Now
              </button>
              <button
                onClick={captureWithDelay}
                class="flex items-center gap-1 px-3.5 py-1.5 rounded-md border border-border-default bg-bg-tertiary text-text-primary text-xs cursor-pointer hover:bg-bg-hover"
              >
                <TbOutlineClock size={14} />
                3s Delay
              </button>
              <button
                onClick={cancel}
                class="flex items-center p-1.5 rounded-md border border-border-default bg-bg-tertiary text-text-secondary cursor-pointer hover:bg-bg-hover"
              >
                <TbOutlineX size={14} />
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Phase 1.5: Countdown */}
      <Show when={phase() === "countdown"}>
        <div class="w-screen h-screen overflow-hidden flex items-center justify-center bg-bg-secondary font-sans text-white">
          <div class="text-5xl font-semibold text-accent">
            {countdown()}
          </div>
        </div>
      </Show>

      {/* Phase 1.75: Capturing (blank while hidden) */}
      <Show when={phase() === "capturing"}>
        <div class="w-screen h-screen bg-black" />
      </Show>

      {/* Phase 2: Selection */}
      <Show when={phase() === "selection"}>
        <div
          class="fixed inset-0 cursor-crosshair select-none overflow-hidden bg-black"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Show when={imageDataUri()}>
            <img
              src={imageDataUri()}
              onLoad={() => setImageLoaded(true)}
              class="absolute inset-0 w-full h-full object-fill pointer-events-none"
              draggable={false}
            />
          </Show>

          <Show when={imageLoaded()}>
            <div
              class="absolute inset-0 pointer-events-none"
              style={{
                "background-color": "rgba(0, 0, 0, 0.4)",
                "clip-path": clipPath(),
              }}
            />
          </Show>

          <Show when={selection()}>
            {(sel) => (
              <div
                class="absolute pointer-events-none border-2 border-accent"
                style={{
                  left: `${sel().x}px`,
                  top: `${sel().y}px`,
                  width: `${sel().width}px`,
                  height: `${sel().height}px`,
                  "box-shadow": "0 0 0 1px rgba(0,0,0,0.3)",
                }}
              />
            )}
          </Show>

          <Show when={isDragging() && selection()}>
            {(sel) => (
              <div
                class="absolute pointer-events-none whitespace-nowrap text-xs text-white px-2 py-0.5 rounded"
                style={{
                  left: `${sel().x + sel().width / 2}px`,
                  top: `${sel().y + sel().height + 8}px`,
                  transform: "translateX(-50%)",
                  "background-color": "rgba(0, 0, 0, 0.75)",
                }}
              >
                {Math.round(sel().width)} × {Math.round(sel().height)}
              </div>
            )}
          </Show>

          <Show when={imageLoaded() && !isDragging() && !selection()}>
            <div
              class="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none text-sm text-white px-4 py-2 rounded-lg"
              style={{ "background-color": "rgba(0, 0, 0, 0.75)" }}
            >
              Click and drag to select · Escape to cancel
            </div>
          </Show>
        </div>
      </Show>
    </>
  );
};
