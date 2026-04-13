// Plugin system types — reserved for future ACP capabilities integration

export interface Plugin {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  capabilities: string[];
}
