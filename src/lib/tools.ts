export interface BuiltinToolInfo {
  id: string;
  name: string;
  description: string;
  requiresApproval: boolean;
}

export const BUILTIN_TOOLS: BuiltinToolInfo[] = [
  { id: "read", name: "Read", description: "Read files and directories from the filesystem", requiresApproval: false },
  { id: "write", name: "Write", description: "Create or replace a text file", requiresApproval: true },
  { id: "edit", name: "Edit", description: "Edit a file with string replacements", requiresApproval: true },
  { id: "glob", name: "Glob", description: "Fast file pattern matching across the codebase", requiresApproval: false },
  { id: "grep", name: "Grep", description: "Fast content search with regex, filtering, and pagination", requiresApproval: false },
  { id: "bash", name: "Bash", description: "Execute a bash command", requiresApproval: true },
  { id: "powershell", name: "PowerShell", description: "Execute a PowerShell command", requiresApproval: true },
  { id: "webfetch", name: "WebFetch", description: "Fetch content from a URL", requiresApproval: true },
  { id: "python_exec", name: "Python", description: "Execute Python code for computation and tool orchestration", requiresApproval: true },
];
