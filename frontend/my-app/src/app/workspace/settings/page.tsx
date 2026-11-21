"use client";

// Account settings: account information, theme preference, sign out.

import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { getStrings } from "@/lib/strings";
import { useTheme, type ThemeChoice } from "@/lib/theme";

export default function SettingsPage() {
  const { user, signOutUser } = useAuth();
  const { choice, setChoice } = useTheme();
  const { language } = useLang();
  const t = getStrings(language);
  const router = useRouter();

  const themeOptions: Array<{ value: ThemeChoice; label: string; hint: string }> = [
    { value: "light", label: t.themeLight, hint: t.stThemeLightHint },
    { value: "dark", label: t.themeDark, hint: t.stThemeDarkHint },
    { value: "system", label: t.themeSystem, hint: t.stThemeSystemHint },
  ];

  const signOut = async () => {
    await signOutUser();
    router.replace("/login");
  };

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t.stTitle}</h1>

      <Card title={t.stAccount}>
        <dl className="divide-y divide-edge text-sm">
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-muted">{t.stEmail}</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-muted">{t.stDisplayName}</dt>
            <dd className="font-medium">{user?.displayName || t.commonNotSet}</dd>
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
              className="flex cursor-pointer items-start gap-3 rounded-md border border-edge p-3 transition-colors duration-150 ease-out hover:bg-brand-soft"
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
