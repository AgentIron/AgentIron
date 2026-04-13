import { type Component } from "solid-js";
import { TbOutlineFolder } from "solid-icons/tb";
import { open } from "@tauri-apps/plugin-dialog";
import { useAgent } from "@context/AgentContext";
import { useSettings } from "@context/SettingsContext";

export const DirectoryIndicator: Component = () => {
  const { activeConnection, changeWorkingDirectory } = useAgent();
  const { activeApiKey } = useSettings();

  const displayPath = () => {
    const conn = activeConnection();
    if (!conn?.workingDirectory) return "~";
    // Shorten the path for display
    const full = conn.workingDirectory;
    const home = getHomePortion(full);
    return home ?? full;
  };

  const handleClick = async () => {
    const conn = activeConnection();
    if (!conn) return;

    const selected = await open({
      directory: true,
      multiple: false,
      title: "Change working directory",
      defaultPath: conn.workingDirectory,
    });

    if (!selected || selected === conn.workingDirectory) return;

    try {
      await changeWorkingDirectory(
        conn.id,
        activeApiKey(),
        conn.name,
        selected as string,
      );
    } catch (err) {
      console.error("Failed to change directory:", err);
    }
  };

  return (
    <button
      onClick={handleClick}
      class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors font-mono truncate max-w-[50%]"
      title={activeConnection()?.workingDirectory ?? "Home directory"}
    >
      <TbOutlineFolder size={13} class="flex-shrink-0" />
      <span class="truncate">{displayPath()}</span>
    </button>
  );
};

function getHomePortion(path: string): string | null {
  // Replace common home prefixes with ~
  const homePatterns = [
    /^C:\\Users\\[^\\]+/i,
    /^\/home\/[^/]+/,
    /^\/Users\/[^/]+/,
  ];
  for (const pattern of homePatterns) {
    const match = path.match(pattern);
    if (match) {
      const rest = path.slice(match[0].length);
      if (!rest) return "~";
      return "~" + rest;
    }
  }
  return null;
}
