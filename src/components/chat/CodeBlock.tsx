import { createSignal, createMemo, type Component } from "solid-js";
import { TbOutlineCopy, TbOutlineCheck } from "solid-icons/tb";
import Prism from "prismjs";

interface CodeBlockProps {
  language?: string;
  children: string;
}

function normalizeLang(lang: string): string {
  const l = lang.toLowerCase();
  if (l === "js" || l === "jsx") return "javascript";
  if (l === "ts" || l === "tsx") return "typescript";
  if (l === "sh" || l === "shell" || l === "zsh") return "bash";
  if (l === "html" || l === "xml" || l === "svg") return "markup";
  if (l === "yml") return "yaml";
  return l;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const CodeBlock: Component<CodeBlockProps> = (props) => {
  const [copied, setCopied] = createSignal(false);

  const lang = () => normalizeLang(props.language || "");
  const displayLang = () => props.language || "text";

  const highlighted = createMemo(() => {
    const code = props.children || "";
    const grammar = Prism.languages[lang()];
    if (grammar) {
      return Prism.highlight(code, grammar, lang());
    }
    return escapeHtml(code);
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(props.children || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="rounded-lg overflow-hidden my-3 border border-border-subtle">
      <div class="flex items-center justify-between px-4 py-1.5 bg-bg-elevated">
        <span class="text-xs text-text-tertiary font-mono">{displayLang()}</span>
        <button
          onClick={handleCopy}
          class="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          {copied() ? (
            <>
              <TbOutlineCheck size={14} class="text-success" />
              <span class="text-success">Copied</span>
            </>
          ) : (
            <>
              <TbOutlineCopy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre class="bg-bg-secondary p-4 overflow-x-auto m-0"><code
          class="font-mono text-sm leading-relaxed"
          innerHTML={highlighted()}
        /></pre>
    </div>
  );
};
