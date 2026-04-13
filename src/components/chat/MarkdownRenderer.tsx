import { createSignal, createEffect, createMemo, onCleanup, type Component } from "solid-js";
import { Marked } from "marked";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";

interface MarkdownRendererProps {
  content: string;
}

function normalizeLang(lang: string): string {
  const l = lang.toLowerCase();
  if (l === "js" || l === "jsx") return "javascript";
  if (l === "ts" || l === "tsx") return "typescript";
  if (l === "sh" || l === "shell" || l === "zsh") return "bash";
  if (l === "html" || l === "xml" || l === "svg") return "markup";
  if (l === "yml") return "yaml";
  if (l === "md") return "markdown";
  return l;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Marked v18 may HTML-escape the code text before passing to the renderer.
// Unescape it so Prism gets raw code to tokenize.
function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function highlightCode(code: string, lang: string): string {
  const raw = unescapeHtml(code);
  const normalized = normalizeLang(lang);
  const grammar = Prism.languages[normalized];
  if (grammar) {
    return Prism.highlight(raw, grammar, normalized);
  }
  return escapeHtml(raw);
}

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      const language = lang || "text";
      const highlighted = highlightCode(text, language);

      return `<div class="code-block-wrapper rounded-lg overflow-hidden my-3 border border-border-subtle">
<div class="flex items-center justify-between px-4 py-1.5 bg-bg-elevated">
<span class="text-xs text-text-tertiary font-mono">${escapeHtml(language)}</span>
<button onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)})" class="code-copy-btn text-xs text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">Copy</button>
</div>
<pre class="bg-bg-secondary p-4 overflow-x-auto m-0"><code class="font-mono text-sm leading-relaxed">${highlighted}</code></pre>
</div>`;
    },
    codespan({ text }) {
      return `<code class="inline-code">${text}</code>`;
    },
    link({ href, text }) {
      return `<a href="${escapeHtml(href || "")}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

export const MarkdownRenderer: Component<MarkdownRendererProps> = (props) => {
  // Debounce parsing during fast streaming to limit to ~20 parses/sec
  const [debouncedContent, setDebouncedContent] = createSignal(props.content || "");
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    const c = props.content;
    clearTimeout(timer);
    timer = setTimeout(() => setDebouncedContent(c || ""), 50);
  });
  onCleanup(() => clearTimeout(timer));

  const html = createMemo(() => {
    const c = debouncedContent();
    if (!c) return "";
    return marked.parse(c, { async: false }) as string;
  });

  return <div class="prose-custom" innerHTML={html()} />;
};
