import { Show, type Component } from "solid-js";
import { Transition } from "solid-transition-group";
import { TbOutlineCheck, TbOutlineX, TbOutlineShieldCheck } from "solid-icons/tb";
import { useChat } from "@context/ChatContext";
import { useAgent } from "@context/AgentContext";
import { toolIcon, formatArgsSummary } from "./toolUtils";

export const ApprovalBar: Component = () => {
  const { state: agentState } = useAgent();
  const { getPendingApproval, respondApproval, respondApproveAll } = useChat();

  const tabId = () => agentState.activeTabId ?? "";
  const pending = () => getPendingApproval(tabId());

  return (
    <Transition name="slide-up">
    <Show when={pending()}>
      {(approval) => (
        <div class="px-6 py-3 border-t border-border-default bg-bg-elevated">
          <div class="flex items-center gap-3">
            {toolIcon(approval().toolName)}
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-text-primary">
                  {approval().toolName}
                </span>
                <span class="text-xs text-text-tertiary font-mono truncate">
                  {formatArgsSummary(approval().toolName, approval().arguments)}
                </span>
              </div>
              <span class="text-xs text-warning">Requires approval to run</span>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => respondApproval(tabId(), approval().callId, true)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-success/20 text-success hover:bg-success/30 transition-colors"
              >
                <TbOutlineCheck size={13} />
                Approve
              </button>
              <button
                onClick={() => respondApproveAll(tabId(), approval().callId, approval().toolName)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                title={`Auto-approve all "${approval().toolName}" calls this session`}
              >
                <TbOutlineShieldCheck size={13} />
                Approve All
              </button>
              <button
                onClick={() => respondApproval(tabId(), approval().callId, false)}
                class="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-error/20 text-error hover:bg-error/30 transition-colors"
              >
                <TbOutlineX size={13} />
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
    </Transition>
  );
};
