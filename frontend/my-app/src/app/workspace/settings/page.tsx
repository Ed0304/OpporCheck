"use client";

// Account settings: account information (including display-name editing
// for email/password users), theme preference, sign out.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, PageHeader, TextInput } from "@/components/ui";
import { friendlyAuthError, useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { format, getStrings } from "@/lib/strings";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const DISPLAY_NAME_MAX_LENGTH = 60;

export default function SettingsPage() {
  const { user, signOutUser, updateDisplayName } = useAuth();
  const { choice, setChoice } = useTheme();
  const { language } = useLang();
  const t = getStrings(language);
  const router = useRouter();

  const hasPasswordProvider =
    user?.providerData.some((profile) => profile.providerId === "password") ?? false;
  // Null until the user types, so a late-arriving auth state still
  // prefills the field without clobbering edits.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = draft ?? user?.displayName ?? "";

  const themeOptions: Array<{ value: ThemeChoice; label: string; hint: string }> = [
    { value: "light", label: t.themeLight, hint: t.stThemeLightHint },
    { value: "dark", label: t.themeDark, hint: t.stThemeDarkHint },
    { value: "system", label: t.themeSystem, hint: t.stThemeSystemHint },
  ];

  const signOut = async () => {
    await signOutUser();
    router.replace("/login");
  };

  const saveDisplayName = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setSaved(false);
      setFormError(t.stDisplayNameEmpty);
      return;
    }
    if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      setSaved(false);
      setFormError(format(t.stDisplayNameTooLong, { max: String(DISPLAY_NAME_MAX_LENGTH) }));
      return;
    }
    setSaving(true);
    setFormError(null);
    setSaved(false);
    try {
      await updateDisplayName(trimmed);
      setDraft(trimmed);
      setSaved(true);
    } catch (err: unknown) {
      setFormError(friendlyAuthError(err, language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow={t.wsSidebarAria} title={t.stTitle} />

      <Card title={t.stAccount}>
        <dl className="divide-y divide-edge text-sm">
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-muted">{t.stEmail}</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="pt-2 text-muted">{t.stDisplayName}</dt>
            <dd className="w-full max-w-xs">
              {hasPasswordProvider ? (
                <form onSubmit={(event) => void saveDisplayName(event)}>
                  <label htmlFor="display-name" className="sr-only">
                    {t.stDisplayName}
                  </label>
                  <TextInput
                    id="display-name"
                    value={name}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setSaved(false);
                      setFormError(null);
                    }}
                    placeholder={t.stDisplayNamePlaceholder}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    autoComplete="nickname"
                  />
                  <p className="mt-1 text-[13px] leading-5 text-muted">{t.stDisplayNameHint}</p>
                  {formError && (
                    <p role="alert" className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">
                      {formError}
                    </p>
                  )}
                  {saved && !formError && (
                    <p role="status" className="mt-1 text-sm font-medium text-evidence">
                      {t.stDisplayNameSaved}
                    </p>
                  )}
                  <div className="mt-2">
                    <Button type="submit" variant="secondary" size="sm" disabled={saving}>
                      {saving ? t.stDisplayNameSaving : t.stDisplayNameSave}
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-right font-medium">{user?.displayName || t.commonNotSet}</p>
                  <p className="mt-1 text-right text-[13px] leading-5 text-muted">
                    {t.stDisplayNameManaged}
                  </p>
                </>
              )}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-muted">{t.stSignInMethod}</dt>
            <dd className="font-medium">
              {user?.providerData.map((profile) => profile.providerId).join(", ") || "—"}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title={t.stAppearance} description={t.stAppearanceDesc}>
        <div role="radiogroup" aria-label={t.stThemeAria} className="flex flex-col gap-2">
          {themeOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge p-4 transition-colors duration-150 ease-out hover:bg-brand-soft"
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={choice === option.value}
                onChange={() => setChoice(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card title={t.headerSignOut}>
        <Button variant="secondary" onClick={() => void signOut()}>
          {t.headerSignOut}
        </Button>
      </Card>
    </div>
  );
}
