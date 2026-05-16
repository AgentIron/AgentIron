import {
  createContext,
  useContext,
  type Component,
  type JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useNotification } from "@context/NotificationContext";
import {
  refreshSkillCatalog,
  listAvailableSkills,
  activateSkill,
  deactivateSkill,
  listActiveSkills,
} from "@lib/tauri/commands";

export interface SkillItem {
  id: string;
  displayName: string;
  description: string;
  origin: string;
  autoActivate: boolean;
  tags: string[];
  requiresTools: string[];
  requiresCapabilities: string[];
  requiresTrust: boolean;
  active: boolean;
}

export interface SkillCatalogEntry {
  skills: SkillItem[];
  diagnostics: { level: string; message: string; skillName?: string }[];
  lastRefreshSummary: { warnings: number; errors: number } | null;
  loading: boolean;
  loaded: boolean;
  error: string | null;
}

interface SkillCatalogContextValue {
  getCatalog: (tabId: string) => SkillCatalogEntry;
  loadSkills: (tabId: string) => Promise<void>;
  toggleSkill: (tabId: string, skillId: string, currentlyActive: boolean) => Promise<void>;
}

const SkillCatalogContext = createContext<SkillCatalogContextValue>();

const EMPTY_ENTRY: SkillCatalogEntry = {
  skills: [],
  diagnostics: [],
  lastRefreshSummary: null,
  loading: false,
  loaded: false,
  error: null,
};

export const SkillCatalogProvider: Component<{ children: JSX.Element }> = (
  props,
) => {
  const { notify } = useNotification();
  const [catalogs, setCatalogs] = createStore<Record<string, SkillCatalogEntry>>({});

  const ensureEntry = (tabId: string) => {
    if (!(tabId in catalogs)) {
      setCatalogs(tabId, { ...EMPTY_ENTRY });
    }
  };

  const getCatalog = (tabId: string): SkillCatalogEntry => {
    return catalogs[tabId] ?? EMPTY_ENTRY;
  };

  const loadSkills = async (tabId: string) => {
    ensureEntry(tabId);
    const entry = catalogs[tabId];
    if (entry && entry.loading) return;

    setCatalogs(
      tabId,
      produce((s) => {
        s.loading = true;
        s.error = null;
      }),
    );

    try {
      const [diag, available, active] = await Promise.all([
        refreshSkillCatalog(tabId),
        listAvailableSkills(tabId),
        listActiveSkills(tabId),
      ]);

      const errors = diag.filter((d) => d.level === "Error").length;
      const warnings = diag.filter((d) => d.level === "Warning").length;

      if (errors > 0) {
        notify(
          "error",
          `Skill refresh completed with ${errors} error${errors === 1 ? "" : "s"}`,
          {
            message:
              warnings > 0
                ? `and ${warnings} warning${warnings === 1 ? "" : "s"}`
                : undefined,
          },
        );
      } else if (warnings > 0) {
        notify(
          "warning",
          `Skill refresh completed with ${warnings} warning${warnings === 1 ? "" : "s"}`,
        );
      }

      setCatalogs(
        tabId,
        produce((s) => {
          s.skills = available.map((sk) => ({
            ...sk,
            active: active.includes(sk.id),
          }));
          s.diagnostics = diag;
          s.lastRefreshSummary = { warnings, errors };
          s.loaded = true;
          s.loading = false;
          s.error = null;
        }),
      );
    } catch (err) {
      console.error("Failed to load skills:", err);
      notify("error", "Failed to refresh skills", { message: String(err) });
      setCatalogs(
        tabId,
        produce((s) => {
          s.loading = false;
          s.error = String(err);
        }),
      );
    }
  };

  const toggleSkill = async (
    tabId: string,
    skillId: string,
    currentlyActive: boolean,
  ) => {
    try {
      if (currentlyActive) {
        await deactivateSkill(tabId, skillId);
      } else {
        await activateSkill(tabId, skillId);
      }
      await loadSkills(tabId);
    } catch (err) {
      console.error("Failed to toggle skill:", err);
      notify(
        "error",
        currentlyActive ? "Failed to deactivate skill" : "Failed to activate skill",
        { message: String(err) },
      );
    }
  };

  const value: SkillCatalogContextValue = {
    getCatalog,
    loadSkills,
    toggleSkill,
  };

  return (
    <SkillCatalogContext.Provider value={value}>
      {props.children}
    </SkillCatalogContext.Provider>
  );
};

export const useSkillCatalog = () => {
  const ctx = useContext(SkillCatalogContext);
  if (!ctx) throw new Error("useSkillCatalog must be used within SkillCatalogProvider");
  return ctx;
};
