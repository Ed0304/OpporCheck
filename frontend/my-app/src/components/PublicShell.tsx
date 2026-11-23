// Shared shell for public pages: top navigation, main landmark, footer.

"use client";

import AppHeader, { type NavLink } from "./AppHeader";
import SiteFooter from "./SiteFooter";
import { useLang } from "@/lib/lang";
import { getStrings, type UiLanguage } from "@/lib/strings";

export function getPublicLinks(language: UiLanguage): NavLink[] {
  const t = getStrings(language);
  return [
    { href: "/about", label: t.navAbout },
    { href: "/how-it-works", label: t.navHowItWorks },
    { href: "/resources", label: t.navResources },
  ];
}

/** English default, kept for existing imports; UI code prefers getPublicLinks. */
export const PUBLIC_LINKS: NavLink[] = getPublicLinks("en");

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const { language } = useLang();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader links={getPublicLinks(language)} />
      <main id="main-content" className="oc-page-glow mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:py-14">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
