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

## Installation

Download the latest release for your platform from the [Releases](https://github.com/AgentIron/AgentIron/releases) page.

### macOS (Apple Silicon)

1. Download the `.dmg` file from the latest release
2. Open the `.dmg` and drag **AgentIron** to your Applications folder
3. On first launch, you may need to right-click the app and select **Open** to bypass Gatekeeper

### Windows

1. Download the `.msi` (recommended) or `.exe` installer from the latest release
2. Run the installer and follow the prompts
3. Launch AgentIron from the Start Menu or desktop shortcut

### Linux

**Debian/Ubuntu:**
```bash
sudo dpkg -i agentiron_*.deb
# If dependency errors occur:
sudo apt-get install -f
```

**Other distributions (AppImage):**
```bash
chmod +x agentiron_*.AppImage
./agentiron_*.AppImage
```

## Building from Source

See [Prerequisites](#prerequisites) and [Getting Started](#getting-started) above.

## Release Build Secrets

The following repository secrets are **optional** but recommended for signed release builds. The workflow will produce unsigned artifacts if secrets are not configured.

### macOS Signing (Optional)
- `APPLE_CERTIFICATE` — Base64-encoded Apple Developer ID Application certificate (`.p12`)
- `APPLE_CERTIFICATE_PASSWORD` — Password for the `.p12` file
- `APPLE_ID` — Apple ID email for notarization
- `APPLE_PASSWORD` — App-specific password for notarization
- `APPLE_TEAM_ID` — Apple Developer Team ID

### Windows Signing (Optional)
- `WINDOWS_CERTIFICATE` — Base64-encoded code signing certificate (`.pfx`)
- `WINDOWS_CERTIFICATE_PASSWORD` — Password for the `.pfx` file

### Auto-Updater (Future)
- `TAURI_SIGNING_PRIVATE_KEY` — Private key for update bundle signing (only needed if auto-updater is enabled)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — Password for the private key

## License

[Apache License 2.0](LICENSE)
