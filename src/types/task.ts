export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  prompt: string;
  agentConfigId?: string;
  enabled: boolean;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}
