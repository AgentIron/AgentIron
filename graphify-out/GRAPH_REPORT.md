# Graph Report - AgentIron  (2026-05-13)

## Corpus Check
- 119 files · ~46,362 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 826 nodes · 1210 edges · 60 communities (55 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `81fe7ad2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]

## God Nodes (most connected - your core abstractions)
1. `useSettings()` - 28 edges
2. `useAgent()` - 23 edges
3. `useUI()` - 15 edges
4. `AgentIron` - 12 edges
5. `toolIcon()` - 10 edges
6. `ADDED Requirements` - 10 edges
7. `useMcp()` - 9 edges
8. `Decisions` - 9 edges
9. `SqliteCredentialStore` - 8 edges
10. `parseModelSlug()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `McpSettings()` --calls--> `Transport`  [INFERRED]
  src/components/settings/McpSettings.tsx → src/types/agent.ts
- `spawn_agent_worker()` --calls--> `create_agent()`  [INFERRED]
  src-tauri/src/state.rs → src-tauri/src/commands/agent.rs
- `toolIcon()` --calls--> `ToolRow()`  [EXTRACTED]
  src/components/chat/toolUtils.tsx → src/components/settings/PluginsSettings.tsx
- `ProviderCard()` --calls--> `useSettings()`  [EXTRACTED]
  src/components/settings/ProviderSettings.tsx → src/context/SettingsContext.tsx
- `main()` --calls--> `run()`  [INFERRED]
  src-tauri/src/main.rs → src-tauri/src/lib.rs

## Communities (60 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (38): AgentCardProps, ApprovalBar(), ChatArea(), ContextIndicator(), DirectoryIndicator(), MessageInput(), ModelSwitcher(), ButtonProps (+30 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (16): AgentInfo, build_provider(), create_agent(), ChatMessage, ApiCost, ApiLimit, ApiModalities, ApiModel (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (27): CodeBlock(), CodeBlockProps, ToolActivityLine(), ToolActivityLineProps, ToolActivitySummary(), ToolActivitySummaryProps, ToolDetailItem(), ToolCallMessage() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (29): DB_KEY_MAP, DEFAULTS, JSON_KEYS, persistSetting(), ProviderAuthStatus, SettingsContext, SettingsContextValue, AuthCapability (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (24): McpContext, McpContextValue, McpState, useMcp(), McpPanel(), McpServerCard(), McpServerCardProps, CATEGORY_LABELS (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (32): AgentIron, Auto-Updater (Future), Branch Protection, Building from Source, Built-in Tools, Chat & Agent Interaction, code:bash (# Clone the repository), code:block2 (AgentIron/) (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (24): AcpClient, AttachedImage, plugin_dialog, Diagnostic, SkillItem, activateSkill(), cancelActivePrompt(), compactSession() (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (23): subscribeToAgentStream(), AcpPromptOptions, AcpSessionEvent, AcpTransport, GroupedEntry, groupEntries(), ChatContext, ChatContextValue (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (28): ADDED Requirements, Requirement: AgentIron SHALL construct providers through the upstream provider registry, Requirement: AgentIron SHALL expose device-code OAuth provider commands, Requirement: AgentIron SHALL include Codex in provider selection, Requirement: AgentIron SHALL keep provider-specific OAuth research separate from app integration, Requirement: AgentIron SHALL load provider auth status before automatic session creation, Requirement: AgentIron SHALL refresh OAuth access tokens during provider resolution, Requirement: AgentIron SHALL store OAuth provider credentials separately from settings JSON (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (23): escapeHtml(), highlightCode(), MarkdownRenderer(), MarkdownRendererProps, marked, normalizeLang(), unescapeHtml(), MessageBubble() (+15 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (22): arc, AgentHandle, AgentParams, AgentRequest, ApprovalDecision, AppState, build_mcp_config(), emit_token_count() (+14 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (22): ADDED Requirements, Requirement: AgentIron SHALL authenticate Codex with validated OAuth credentials, Requirement: AgentIron SHALL authenticate Kimi Code with validated OAuth credentials, Requirement: OAuth validation SHALL avoid storing or exposing secrets, Requirement: Provider-specific findings SHALL be documented and linked, Requirement: Provider-specific OAuth behavior SHALL remain outside AgentIron UI logic, Scenario: Automated tests cover provider semantics, Scenario: Codex auth metadata is incorrect (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (21): ADDED Requirements, MODIFIED Requirements, Requirement: AgentIron SHALL build release artifacts on version tag push, Requirement: AgentIron SHALL build release packages from the release tag, Requirement: AgentIron SHALL not create automatic release-bump PRs after normal merges, Requirement: AgentIron SHALL provide a manual direct release workflow, Requirement: AgentIron SHALL publish GitHub Releases with built artifacts, Requirement: AgentIron SHALL tag the exact release commit (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (13): capture_snip(), complete_snip(), SnipData, SnipRegion, SnipState, start_snip(), cursor, deserialize (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (12): BUILTIN_TOOLS, BuiltinToolInfo, PluginsSettings(), ToolRow(), ProviderSettings(), Section, SECTION_COMPONENTS, SECTIONS (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (15): ADDED Requirements, Requirement: AgentIron SHALL build release artifacts on version tag push, Requirement: AgentIron SHALL produce Linux artifacts, Requirement: AgentIron SHALL produce signed macOS artifacts, Requirement: AgentIron SHALL produce signed Windows artifacts, Requirement: AgentIron SHALL provide installation documentation, Scenario: AppImage is executable, Scenario: Linux artifacts are produced (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.12
Nodes (15): Cache provider auth status in frontend state, code:text (if provider has a non-empty API key:), Context, Decisions, Do not add an auth-mode preference for the MVP, Goals / Non-Goals, Keep API keys in existing settings for this change, Keep the existing provider-injection worker architecture (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (15): code:text (┌──────────────────┐), code:text (API key      -> x-api-key: <api_key>), Context, Decisions, Device-code is the OAuth interaction target for this change, Goals / Non-Goals, Keep `codex` separate from public `openai`, Migration Plan (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.24
Nodes (13): auth_status_response(), DeviceCodeStartResponse, get_provider_auth_status(), is_retryable_oauth_poll_error(), kimi_code_uses_validated_oauth_metadata(), looks_like_cloudflare_challenge(), oauth_flow_key(), oauth_http_client() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.13
Nodes (14): ADDED Requirements, Requirement: AgentIron SHALL preserve rich plugin tool results, Requirement: AgentIron SHALL render supported plugin rich views, Requirement: AgentIron SHALL support plugin auth flows, Requirement: AgentIron SHALL surface plugin auth state to the UI, Scenario: Auth prompts are requested, Scenario: Auth state changes during a session, Scenario: Plugin tool returns plain JSON only (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (14): ADDED Requirements, Requirement: AgentIron SHALL expose the skill catalog and diagnostics, Requirement: AgentIron SHALL make project skill trust explicit, Requirement: AgentIron SHALL support session handoff export and import, Requirement: AgentIron SHALL support session skill activation, Scenario: Discovery produced warnings, Scenario: Project skill trust is disabled, Scenario: Project skill trust is enabled (+6 more)

### Community 21 - "Community 21"
Cohesion: 0.42
Nodes (6): list_slugs(), remove_credential(), roundtrip_api_key(), roundtrip_oauth_bearer(), SqliteCredentialStore, temp_db()

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (13): ADDED Requirements, Requirement: AgentIron SHALL configure and register runtime plugins, Requirement: AgentIron SHALL expose plugin inventory and status, Requirement: AgentIron SHALL provide a plugin management UI, Requirement: AgentIron SHALL support per-session plugin enablement, Scenario: Configured plugins are loaded into the runtime, Scenario: Frontend requests plugin inventory, Scenario: Invalid plugin configuration is rejected (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.19
Nodes (13): json, pathlib, re, bump_cargo_toml(), bump_package_json(), bump_semver(), bump_tauri_conf(), main() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (12): code:block1 (Normal development), code:block2 (Manual release), code:block3 (AGENTIRON_RELEASE_TOKEN), Context, Failure and Rerun Behavior, Goals / Non-Goals, Open Questions, Proposed Flow (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (10): ADDED Requirements, Requirement: AgentIron SHALL enforce in-process transport, Requirement: AgentIron SHALL support prompt cancellation, Requirement: AgentIron SHALL surface script activity events, Scenario: Chat UI receives script activity events, Scenario: Script execution emits activity events, Scenario: User cancels after completion, Scenario: User cancels an active prompt (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (8): 1. Backend Credential Storage, 2. Backend OAuth Commands, 3. Provider Construction, 4. Frontend Command Bindings And Types, 5. Frontend Auth Status State, 6. Provider Settings UX, 7. Follow-Up Tracking, 8. Verification

### Community 27 - "Community 27"
Cohesion: 0.29
Nodes (6): manager, menu, run(), configure_linux_graphics_workarounds(), main(), trayiconbuilder

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (6): Context, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (6): Context, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (6): Context, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 34 - "Community 34"
Cohesion: 0.29
Nodes (6): 1. Workflow and Configuration, 2. macOS Signing Setup, 3. Windows Signing Setup, 4. Linux Build Setup, 5. Release and Documentation, 6. Verification (Manual — requires actual hardware)

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (6): Context, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 36 - "Community 36"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (6): Context, Decisions, Goals / Non-Goals, Migration Plan, Open Questions, Risks / Trade-offs

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 39 - "Community 39"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (6): 1. Release Workflow Simplification, 2. Release Identity and Guardrails, 3. Tagging and Build Jobs, 4. GitHub Release Publishing, 5. Cleanup and Documentation, 6. Verification

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (6): Capabilities, Impact, Modified Capabilities, New Capabilities, What Changes, Why

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (5): 1. Provider Flow Research, 2. Upstream Metadata And Provider Corrections, 3. AgentIron Integration Adjustments, 4. End-To-End Validation, 5. Final Checks

### Community 44 - "Community 44"
Cohesion: 0.6
Nodes (4): plugin_autostart, disableAutostart(), enableAutostart(), isAutostartEnabled()

### Community 45 - "Community 45"
Cohesion: 0.4
Nodes (4): 1. Backend Auth Surface, 2. Rich Tool Event Plumbing, 3. Frontend UX, 4. Verification

### Community 46 - "Community 46"
Cohesion: 0.4
Nodes (4): 1. Settings And Types, 2. Backend Plugin Wiring, 3. Frontend Plugin Management, 4. Verification

### Community 47 - "Community 47"
Cohesion: 0.4
Nodes (4): 1. Prompt Control Plumbing, 2. Runtime Activity Events, 3. Transport Support (in-process only), 4. Verification

### Community 48 - "Community 48"
Cohesion: 0.4
Nodes (4): 1. Backend Skill Support, 2. Backend Handoff Support, 3. Frontend UX, 4. Verification

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (3): plugin_global_shortcut, registerQuickLaunch(), unregisterShortcut()

### Community 50 - "Community 50"
Cohesion: 0.5
Nodes (3): path, vite, vite_plugin_solid

## Knowledge Gaps
- **351 isolated node(s):** `AgentRequest`, `ImageDataJson`, `McpErrorCategory`, `McpErrorStage`, `McpServerStatusJson` (+346 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `App()` connect `Community 13` to `Community 0`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `create_agent()` connect `Community 1` to `Community 10`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `AgentRequest`, `ImageDataJson`, `McpErrorCategory` to the rest of the system?**
  _351 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._