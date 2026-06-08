import { For, Show, type Component, type JSX } from "solid-js";
import { TbOutlineArchive, TbOutlineArrowNarrowRight } from "solid-icons/tb";
import { CodeBlock } from "./CodeBlock";
import { extractCompactionMetrics, formatCompactionDelta } from "./toolUtils";
import { formatTokenCount } from "@lib/models";

// ── Argument detail renderers ──

export function renderArgsDetail(toolName: string | undefined, args: unknown): JSX.Element {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;

  switch (toolName) {
    case "read":
      return (
        <div class="space-y-1">
          <DetailRow label="Path" value={a.path as string} mono />
          <Show when={a.offset}><DetailRow label="Offset" value={`line ${a.offset}`} /></Show>
          <Show when={a.limit}><DetailRow label="Limit" value={`${a.limit} lines`} /></Show>
        </div>
      );
    case "write":
      return (
        <div class="space-y-1">
          <DetailRow label="Path" value={a.path as string} mono />
          <DetailBlock label="Content" value={a.content as string} />
        </div>
      );
    case "edit":
      return (
        <div class="space-y-1">
          <DetailRow label="Path" value={a.path as string} mono />
          <DetailBlock label="Old" value={a.old_string as string} />
          <DetailBlock label="New" value={a.new_string as string} />
        </div>
      );
    case "glob":
      return (
        <div class="space-y-1">
          <DetailRow label="Pattern" value={a.pattern as string} mono />
          <Show when={a.path}><DetailRow label="Path" value={a.path as string} mono /></Show>
        </div>
      );
    case "grep":
      return (
        <div class="space-y-1">
          <DetailRow label="Pattern" value={a.pattern as string} mono />
          <Show when={a.path}><DetailRow label="Path" value={a.path as string} mono /></Show>
          <Show when={a.include}><DetailRow label="Include" value={a.include as string} mono /></Show>
          <Show when={a.mode}><DetailRow label="Mode" value={a.mode as string} /></Show>
          <Show when={a.case_insensitive}><DetailRow label="Case insensitive" value="yes" /></Show>
          <Show when={a.multiline}><DetailRow label="Multiline" value="yes" /></Show>
        </div>
      );
    case "bash":
    case "powershell":
      return (
        <div class="space-y-1">
          <CodeBlock language={toolName === "powershell" ? "powershell" : "bash"}>
            {(a.command as string) || ""}
          </CodeBlock>
          <Show when={a.working_dir}><DetailRow label="Working dir" value={a.working_dir as string} mono /></Show>
          <Show when={a.timeout}><DetailRow label="Timeout" value={`${a.timeout}s`} /></Show>
        </div>
      );
    case "python_exec":
      return (
        <div class="space-y-1">
          <CodeBlock language="python">
            {(a.code as string) || (a.script as string) || ""}
          </CodeBlock>
        </div>
      );
    case "webfetch":
      return (
        <div class="space-y-1">
          <DetailRow label="URL" value={a.url as string} mono />
          <Show when={a.format}><DetailRow label="Format" value={a.format as string} /></Show>
        </div>
      );
    default:
      return (
        <pre class="bg-bg-primary rounded p-2 overflow-x-auto font-mono text-text-secondary text-xs">
          {JSON.stringify(args, null, 2)}
        </pre>
      );
  }
}

// ── Compaction renderer (graceful stub) ──
//
// Renders a distinct token-reduction summary when iron-core supplies compaction
// metrics in the result. Returns null when no metrics are present, so callers
// can fall back to the generic result renderer until backend support lands.

export function renderCompactionResult(result: unknown): JSX.Element {
  const metrics = extractCompactionMetrics(result);
  if (!metrics) return null;
  const delta = formatCompactionDelta(metrics);

  return (
    <div class="flex flex-col gap-1.5 rounded-lg border border-accent/30 bg-accent-muted px-3 py-2">
      <div class="flex items-center gap-2 text-xs">
        <TbOutlineArchive size={14} class="text-accent flex-shrink-0" />
        <span class="font-medium text-text-primary">Context compacted</span>
      </div>
      <Show when={metrics.tokensBefore !== undefined && metrics.tokensAfter !== undefined}>
        <div class="flex items-center gap-2 text-xs font-mono text-text-secondary">
          <span>{formatTokenCount(metrics.tokensBefore!)}</span>
          <TbOutlineArrowNarrowRight size={14} class="text-text-tertiary" />
          <span class="text-success">{formatTokenCount(metrics.tokensAfter!)}</span>
          <span class="text-text-tertiary">tokens</span>
        </div>
      </Show>
      <Show when={(metrics.tokensBefore === undefined || metrics.tokensAfter === undefined) && delta}>
        <div class="text-xs font-mono text-text-secondary">{delta}</div>
      </Show>
      <Show when={metrics.method}>
        <DetailRow label="Method" value={metrics.method} />
      </Show>
    </div>
  );
}

// ── Result renderer ──

export function renderResult(_toolName: string | undefined, result: unknown): JSX.Element {
  if (result === null || result === undefined) return null;

  if (typeof result === "object" && (result as any).error) {
    return (
      <div class="bg-error/10 rounded p-2 text-xs text-error font-mono">
        {(result as any).error}
      </div>
    );
  }

  if (typeof result === "string") {
    return (
      <pre class="bg-bg-primary rounded p-2 overflow-x-auto font-mono text-text-secondary text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
        {result.length > 2000 ? result.slice(0, 2000) + "..." : result}
      </pre>
    );
  }

  const r = result as Record<string, unknown>;

  if (r.output || r.stdout) {
    const output = (r.output || r.stdout) as string;
    return (
      <div class="space-y-1">
        <Show when={r.exit_code !== undefined}>
          <DetailRow label="Exit code" value={`${r.exit_code}`} />
        </Show>
        <pre class="bg-bg-primary rounded p-2 overflow-x-auto font-mono text-text-secondary text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
          {output.length > 2000 ? output.slice(0, 2000) + "..." : output}
        </pre>
        <Show when={r.stderr && (r.stderr as string).length > 0}>
          <pre class="bg-error/5 rounded p-2 overflow-x-auto font-mono text-error/80 text-xs max-h-24 overflow-y-auto whitespace-pre-wrap">
            {(r.stderr as string).slice(0, 500)}
          </pre>
        </Show>
      </div>
    );
  }

  if (r.content) {
    const content = r.content as string;
    return (
      <pre class="bg-bg-primary rounded p-2 overflow-x-auto font-mono text-text-secondary text-xs max-h-48 overflow-y-auto whitespace-pre-wrap">
        {content.length > 2000 ? content.slice(0, 2000) + "..." : content}
      </pre>
    );
  }

  if (Array.isArray(r.matches) || Array.isArray(r.files)) {
    const items = (r.matches || r.files) as string[];
    return (
      <div class="bg-bg-primary rounded p-2 text-xs font-mono text-text-secondary max-h-48 overflow-y-auto">
        <For each={items.slice(0, 50)}>
          {(item) => (
            <div class="py-0.5">{typeof item === "string" ? item : JSON.stringify(item)}</div>
          )}
        </For>
        <Show when={items.length > 50}>
          <div class="text-text-tertiary pt-1">... and {items.length - 50} more</div>
        </Show>
      </div>
    );
  }

  return (
    <pre class="bg-bg-primary rounded p-2 overflow-x-auto font-mono text-text-secondary text-xs max-h-48 overflow-y-auto">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

// ── Small helper components ──

export const DetailRow: Component<{ label: string; value: string | undefined; mono?: boolean }> = (props) => (
  <Show when={props.value}>
    <div class="flex items-baseline gap-2 text-xs">
      <span class="text-text-tertiary flex-shrink-0">{props.label}:</span>
      <span class={`text-text-secondary ${props.mono ? "font-mono" : ""} truncate`}>{props.value}</span>
    </div>
  </Show>
);

export const DetailBlock: Component<{ label: string; value: string | undefined }> = (props) => (
  <Show when={props.value}>
    <div class="text-xs">
      <span class="text-text-tertiary">{props.label}:</span>
      <pre class="mt-1 bg-bg-primary rounded p-2 overflow-x-auto font-mono text-text-secondary whitespace-pre-wrap max-h-36 overflow-y-auto">
        {props.value}
      </pre>
    </div>
  </Show>
);
