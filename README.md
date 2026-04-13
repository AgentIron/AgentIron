# AgentIron

A cross-platform AI agent client built on [iron-core](https://github.com/AgentIron/iron-core). AgentIron is a desktop application for interactive agentic development, task scheduling, and personal AI assistance.

## Features

### Chat & Agent Interaction
- Multi-tab agent sessions with independent conversations
- Streaming responses with real-time token display
- Markdown rendering with syntax-highlighted code blocks
- Image upload and multimodal prompts (text + images)
- Screenshot snip tool with selection overlay
- Inline tool call display with collapsible activity summaries
- Tool approval workflow (approve, approve all, deny)
- Context window tracking with visual usage indicator
- `/compact` command for context compaction

### Built-in Tools
- **File operations** — read, write, edit files
- **Search** — glob (file patterns), grep (content search with regex)
- **Shell** — bash and PowerShell execution
- **Web** — fetch content from URLs
- **Python** — embedded Python execution for computation and tool orchestration

### Provider Support
- **OpenAI** — GPT-4o, GPT-4.1, o3-mini, o4-mini
- **Anthropic** — Claude Sonnet 4, Claude 3.7 Sonnet, Claude 3.5 Haiku
- **Minimax** — MiniMax M2.7, M2.5 (general and coding)
- **Zai (Zhipu AI)** — GLM-5.1, GLM-4.7
- **Kimi (Moonshot)** — Kimi K2.5
- **OpenRouter** — access to hundreds of models
- **Requesty** — AI gateway/proxy
- Dynamic model registry sync via [models.dev](https://models.dev)

### MCP (Model Context Protocol) Support
- Configure MCP servers (stdio, HTTP, HTTP+SSE transports)
- Live health monitoring and tool discovery
- Session-scoped server enable/disable
- Side panel showing server status and available tools

### Settings & Configuration
- Persistent settings stored in SQLite
- Provider management with API key storage
- Model favorites with starred quick-switching
- Configurable default model per provider
- User profile settings
- MCP server management

### Desktop Features
- System tray with minimize-to-tray
- Per-tab working directory with folder picker
- Editable tab/session names
- Dark mode UI with Linear/Raycast aesthetic
- Smooth animations and transitions

## Tech Stack

- **[Tauri v2](https://v2.tauri.app/)** — native desktop shell (Windows, macOS, Linux)
- **[SolidJS](https://www.solidjs.com/)** — reactive UI framework
- **[Tailwind CSS v4](https://tailwindcss.com/)** — utility-first styling
- **[iron-core](https://github.com/AgentIron/iron-core)** — AI agent runtime with ACP protocol
- **[iron-providers](https://github.com/AgentIron/iron-providers)** — multi-provider LLM abstraction

## Prerequisites

- [Rust](https://rustup.rs/) (1.91+)
- [Node.js](https://nodejs.org/) (20+)
- [pnpm](https://pnpm.io/) (10+)
- Platform build tools:
  - **Windows**: Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `build-essential`, `libwebkit2gtk-4.1-dev`, `libssl-dev`

## Getting Started

```bash
# Clone the repository
git clone https://github.com/AgentIron/AgentIron.git
cd AgentIron

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

On first launch, configure a provider with an API key in Settings.

## Project Structure

```
AgentIron/
  src/                    # SolidJS frontend
    components/           # UI components
      chat/               # Chat area, messages, tools, input
      layout/             # App shell, sidebar, tabs
      mcp/                # MCP server panel
      settings/           # Settings panels
      snip/               # Screenshot overlay
    context/              # SolidJS context providers
    lib/                  # Utilities (models, tools, Tauri commands)
    types/                # TypeScript type definitions
  src-tauri/              # Rust backend
    src/
      commands/           # Tauri commands (agent, chat, models, snip)
      state.rs            # Agent worker thread and state management
    migrations/           # SQLite schema
```

## Related Repositories

- **[iron-core](https://github.com/AgentIron/iron-core)** — AI agent runtime
- **[iron-providers](https://github.com/AgentIron/iron-providers)** — LLM provider abstraction

## License

[Apache License 2.0](LICENSE)
