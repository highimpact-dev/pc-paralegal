const SETTINGS_KEY = "pc-paralegal-settings";

export interface AppSettings {
  model: string;
}

const defaults: AppSettings = {
  model: "qwen3:8b",
};

export function getSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {}
  return { ...defaults };
}

export function saveSettings(settings: Partial<AppSettings>) {
  const current = getSettings();
  const merged = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

export function getModel(): string {
  return getSettings().model;
}
