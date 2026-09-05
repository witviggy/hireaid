import { useEffect, useState } from "react";
import { Check, CheckCircle2, Laptop, Moon, Save, Sun } from "lucide-react";
import { api } from "../api";
import { GlobalSettings } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { applyTheme, getStoredTheme, Theme } from "../lib/theme";

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTheme, setActiveTheme] = useState<Theme>("light");

  useEffect(() => {
    setActiveTheme(getStoredTheme());
    api
      .getSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  function handleThemeChange(theme: Theme) {
    setActiveTheme(theme);
    applyTheme(theme);
  }

  if (!settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  function update<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function handleSave() {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const updated = await api.updateSettings(settings!);
      setSettings(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#FAFAFA]">
            Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage global voice agent defaults, calling hours, and interface preferences.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Saved successfully
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} className="h-9 text-xs font-medium">
            {saving ? <Spinner /> : <Save className="mr-1.5 h-4 w-4" />} Save Changes
          </Button>
        </div>
      </div>

      {/* 1. Appearance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Appearance</CardTitle>
          <CardDescription className="text-xs">
            Select your interface theme preference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTheme === "light"
                  ? "border-[#2563EB] bg-blue-50/50 text-[#2563EB] ring-1 ring-[#2563EB] dark:bg-blue-950/30 dark:text-blue-400"
                  : "border-[#E5E7EB] bg-white text-slate-700 hover:border-slate-300 dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" /> Light
              </span>
              {activeTheme === "light" && <Check className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTheme === "dark"
                  ? "border-[#2563EB] bg-blue-50/50 text-[#2563EB] ring-1 ring-[#2563EB] dark:bg-blue-950/30 dark:text-blue-400"
                  : "border-[#E5E7EB] bg-white text-slate-700 hover:border-slate-300 dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Moon className="h-4 w-4 text-indigo-400" /> Dark
              </span>
              {activeTheme === "dark" && <Check className="h-3.5 w-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange("system")}
              className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs font-medium transition-all ${
                activeTheme === "system"
                  ? "border-[#2563EB] bg-blue-50/50 text-[#2563EB] ring-1 ring-[#2563EB] dark:bg-blue-950/30 dark:text-blue-400"
                  : "border-[#E5E7EB] bg-white text-slate-700 hover:border-slate-300 dark:border-[#27272A] dark:bg-[#18181B] dark:text-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-slate-500" /> System
              </span>
              {activeTheme === "system" && <Check className="h-3.5 w-3.5" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Voice Agent Defaults */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Voice Agent Defaults</CardTitle>
          <CardDescription className="text-xs">
            Default persona and tone applied to new job requisitions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AI Agent Name</Label>
              <Input
                value={settings.ai_name}
                onChange={(e) => update("ai_name", e.target.value)}
                placeholder="e.g. Maya"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company Name</Label>
              <Input
                value={settings.company_name}
                onChange={(e) => update("company_name", e.target.value)}
                placeholder="e.g. HireAId"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Default Tone</Label>
              <Select
                value={settings.tone || "CONVERSATIONAL"}
                onChange={(e) => update("tone", e.target.value)}
              >
                <option value="CONVERSATIONAL">Conversational (Natural & engaging)</option>
                <option value="PROFESSIONAL">Professional (Formal & direct)</option>
                <option value="CASUAL">Casual (Startup-friendly)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Language / Accent</Label>
              <Select
                value={settings.language || "en-US"}
                onChange={(e) => update("language", e.target.value)}
              >
                <option value="en-US">English (US)</option>
                <option value="en-IN">English (India)</option>
                <option value="en-GB">English (UK)</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Calling Hours & Retries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Calling Window & Retries</CardTitle>
          <CardDescription className="text-xs">
            Outbound calling boundaries and retry schedule rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Calling Hours Start (24h)</Label>
              <Input
                value={settings.calling_hours_start}
                onChange={(e) => update("calling_hours_start", e.target.value)}
                placeholder="09:00"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Calling Hours End (24h)</Label>
              <Input
                value={settings.calling_hours_end}
                onChange={(e) => update("calling_hours_end", e.target.value)}
                placeholder="18:00"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max Retries</Label>
              <Input
                type="number"
                min="1"
                max="5"
                value={settings.max_retries}
                onChange={(e) => update("max_retries", Number(e.target.value))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Retry Delay (Minutes)</Label>
              <Input
                type="number"
                min="5"
                max="1440"
                value={settings.retry_delay_minutes}
                onChange={(e) => update("retry_delay_minutes", Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
