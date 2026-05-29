use iron_core::{DebugEvent, DebugPayload, DebugSink};

pub struct StdoutDebugSink;

impl DebugSink for StdoutDebugSink {
    fn emit(&self, event: DebugEvent) {
        print!(
            "[agent-debug #{} {:?} {}]",
            event.sequence,
            event.severity,
            event.timestamp.format("%Y-%m-%d %H:%M:%S%.3f")
        );

        if let Some(runtime_id) = &event.scope.runtime_id {
            print!(" runtime:{}", runtime_id);
        }
        if let Some(connection_id) = &event.scope.connection_id {
            print!(" connection:{}", connection_id);
        }
        if let Some(session_id) = &event.scope.session_id {
            print!(" session:{}", session_id);
        }
        if let Some(turn_id) = &event.scope.turn_id {
            print!(" turn:{}", turn_id);
        }
        if let Some(tool_call_id) = &event.scope.tool_call_id {
            print!(" tool_call:{}", tool_call_id);
        }
        if let Some(provider) = &event.scope.provider_name {
            print!(" provider:{}", provider);
        }
        if let Some(model) = &event.scope.model_id {
            print!(" model:{}", model);
        }

        println!();

        match &event.payload {
            DebugPayload::Config(config) => match config {
                iron_core::ConfigDebugEvent::RuntimeConfigured {
                    provider_name,
                    model_id,
                    approval_strategy,
                    context_management_enabled,
                    prompt_composition_enabled,
                    tool_policy,
                    plugin_enabled,
                    mcp_enabled,
                    skill_enabled,
                    workspace_roots,
                } => println!(
                    "  config: provider={} model={} approval={} context_mgmt={} prompt_comp={} tool_policy={} plugin={} mcp={} skill={} workspaces={}",
                    provider_name,
                    model_id,
                    approval_strategy,
                    context_management_enabled,
                    prompt_composition_enabled,
                    tool_policy,
                    plugin_enabled,
                    mcp_enabled,
                    skill_enabled,
                    workspace_roots
                ),
                _ => println!("  config: {:?}", config),
            },
            DebugPayload::Prompt(prompt) => match prompt {
                iron_core::PromptDebugEvent::SystemPromptRendered {
                    fingerprint,
                    total_chars,
                    sections,
                    changed,
                } => println!(
                    "  prompt: system_prompt chars={} fingerprint={} sections={} changed={:?}",
                    total_chars, fingerprint, sections.len(), changed
                ),
                iron_core::PromptDebugEvent::ModelInputInfluence {
                    source,
                    destination,
                    effect,
                    reason,
                } => println!(
                    "  prompt: influence source={:?} dest={:?} effect={:?} reason={}",
                    source, destination, effect, reason
                ),
                _ => println!("  prompt: {:?}", prompt),
            },
            DebugPayload::Context(context) => match context {
                iron_core::ContextDebugEvent::SnapshotEstimated {
                    total_tokens,
                    context_window_limit,
                    quality,
                    pressure,
                    categories,
                } => println!(
                    "  context: snapshot tokens={} window={:?} quality={:?} pressure={} categories={}",
                    total_tokens,
                    context_window_limit,
                    quality,
                    pressure,
                    categories.len()
                ),
                iron_core::ContextDebugEvent::PressureChanged {
                    old_pressure,
                    new_pressure,
                    reason,
                } => println!(
                    "  context: pressure changed {} -> {} reason={}",
                    old_pressure, new_pressure, reason
                ),
                _ => println!("  context: {:?}", context),
            },
            DebugPayload::Compaction(compaction) => match compaction {
                iron_core::CompactionDebugEvent::Requested {
                    topic_present,
                    range_count,
                    thresholds,
                } => println!(
                    "  compaction: requested topic={} ranges={} thresholds={:?}",
                    topic_present, range_count, thresholds
                ),
                iron_core::CompactionDebugEvent::Rejected { reason } => {
                    println!("  compaction: rejected reason={}", reason)
                }
                iron_core::CompactionDebugEvent::Applied {
                    block_count,
                    old_size_tokens,
                    new_size_tokens,
                    pressure_state,
                    reduction_pct,
                } => println!(
                    "  compaction: applied blocks={} old={:?} new={:?} pressure={} reduction={:?}%",
                    block_count, old_size_tokens, new_size_tokens, pressure_state, reduction_pct
                ),
                _ => println!("  compaction: {:?}", compaction),
            },
            DebugPayload::Tool(tool) => match tool {
                iron_core::ToolDebugEvent::ApprovalEvaluated {
                    tool_name,
                    approved,
                    decision_source,
                    user_approval_requested,
                    reason,
                } => println!(
                    "  tool: approval tool={} approved={} source={} user_requested={} reason={}",
                    tool_name, approved, decision_source, user_approval_requested, reason
                ),
                iron_core::ToolDebugEvent::ExecutionStarted {
                    tool_name,
                    tool_source,
                    call_id,
                } => println!(
                    "  tool: execution started tool={} source={} call_id={}",
                    tool_name, tool_source, call_id
                ),
                iron_core::ToolDebugEvent::ExecutionFinished {
                    tool_name,
                    call_id,
                    status,
                    duration_ms,
                    truncated,
                    reason,
                } => println!(
                    "  tool: execution finished tool={} call_id={} status={} duration={:?}ms truncated={} reason={:?}",
                    tool_name, call_id, status, duration_ms, truncated, reason
                ),
                _ => println!("  tool: {:?}", tool),
            },
            DebugPayload::Provider(provider) => match provider {
                iron_core::ProviderDebugEvent::ModelSwitchQueued {
                    target_model,
                    target_provider,
                } => println!(
                    "  provider: switch queued model={} provider={}",
                    target_model, target_provider
                ),
                iron_core::ProviderDebugEvent::ModelSwitchPlanCreated {
                    current_tokens,
                    target_window,
                    adaptation_needed,
                    estimate_quality,
                } => println!(
                    "  provider: switch plan tokens={} window={:?} adaptation={} quality={}",
                    current_tokens, target_window, adaptation_needed, estimate_quality
                ),
                iron_core::ProviderDebugEvent::ModelSwitchApplied {
                    from_model,
                    from_provider,
                    to_model,
                    to_provider,
                    capability_diff,
                } => println!(
                    "  provider: switch applied {}@{} -> {}@{} diff={:?}",
                    from_model, from_provider, to_model, to_provider, capability_diff
                ),
                iron_core::ProviderDebugEvent::ModelSwitchFailed {
                    target_model,
                    target_provider,
                    reason,
                } => println!(
                    "  provider: switch failed model={} provider={} reason={}",
                    target_model, target_provider, reason
                ),
                _ => println!("  provider: {:?}", provider),
            },
            DebugPayload::Skill(skill) => match skill {
                iron_core::SkillDebugEvent::CatalogRefreshed {
                    sources,
                    discovered_count,
                    trusted_count,
                    untrusted_count,
                    diagnostic_count,
                } => println!(
                    "  skill: catalog refreshed sources={:?} discovered={} trusted={} untrusted={} diagnostics={}",
                    sources, discovered_count, trusted_count, untrusted_count, diagnostic_count
                ),
                iron_core::SkillDebugEvent::AvailableToSession {
                    count,
                    source_categories,
                } => println!(
                    "  skill: available count={} categories={:?}",
                    count, source_categories
                ),
                iron_core::SkillDebugEvent::ActivationSuccess {
                    skill_name,
                    source_kind,
                    activation_source,
                } => println!(
                    "  skill: activation success name={} source_kind={} activation_source={}",
                    skill_name, source_kind, activation_source
                ),
                iron_core::SkillDebugEvent::ActivationRejected { skill_name, reason } => println!(
                    "  skill: activation rejected name={} reason={}",
                    skill_name, reason
                ),
                _ => println!("  skill: {:?}", skill),
            },
            _ => println!("  payload: {:?}", event.payload),
        }
    }
}

/// Check if debug mode is enabled via CLI arg or environment variable.
pub fn is_debug_mode() -> bool {
    std::env::args().any(|arg| arg == "--debug")
        || std::env::var("AGENTIRON_DEBUG")
            .is_ok_and(|v| matches!(v.as_str(), "1" | "true" | "yes"))
}
