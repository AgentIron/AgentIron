## 1. Settings And Types

- [ ] 1.1 Define persistent frontend types for plugin source configuration and plugin runtime status
- [ ] 1.2 Extend AgentIron settings storage to save and load plugin configuration safely
- [ ] 1.3 Add Tauri command bindings for listing plugins and toggling session plugin enablement

## 2. Backend Plugin Wiring

- [ ] 2.1 Pass plugin runtime configuration into `iron-core::Config` during agent creation
- [ ] 2.2 Register configured plugins in the worker before session creation
- [ ] 2.3 Implement backend commands for querying plugin inventory and setting per-session plugin enablement

## 3. Frontend Plugin Management

- [ ] 3.1 Replace the placeholder Plugins settings pane with inventory-backed UI
- [ ] 3.2 Add controls for enabling and disabling plugins on the active session
- [ ] 3.3 Render plugin health and availability summaries with actionable empty and error states

## 4. Verification

- [ ] 4.1 Verify agent creation still succeeds with no configured plugins
- [ ] 4.2 Verify configured plugins appear in settings and can be toggled per tab
- [ ] 4.3 Build the Rust crate and frontend after the plugin runtime wiring lands
