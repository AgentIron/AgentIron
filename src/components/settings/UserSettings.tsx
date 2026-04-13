import type { Component } from "solid-js";
import { useSettings } from "@context/SettingsContext";

export const UserSettings: Component = () => {
  const { settings, updateSetting } = useSettings();

  const updateProfile = (field: "name" | "email", value: string) => {
    updateSetting("userProfile", { ...settings.userProfile, [field]: value });
  };

  return (
    <div class="space-y-8">
      <section class="space-y-4">
        <div>
          <h2 class="text-base font-semibold text-text-primary">Profile</h2>
          <p class="text-xs text-text-tertiary mt-1">
            Your display name and contact information.
          </p>
        </div>
        <div class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-text-secondary">Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={settings.userProfile.name}
              onInput={(e) => updateProfile("name", e.currentTarget.value)}
              class="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-text-secondary">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={settings.userProfile.email}
              onInput={(e) => updateProfile("email", e.currentTarget.value)}
              class="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
};
