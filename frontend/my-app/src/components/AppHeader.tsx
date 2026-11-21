"use client";

// Global top navigation: brand wordmark, section links, website language
// selector, theme switcher, account menu (or sign-in link). Mobile menu
// opens a navigation drawer.
//
// The pathname hook lives in Suspense-isolated nav components (with static
// fallbacks) so statically prerendered pages keep building: URL data is
// runtime-only and must never run during prerender.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ActivePill, OC_DURATION, OC_EASE } from "@/components/motion";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { UI_LANGUAGES, format, getStrings } from "@/lib/strings";
import { useTheme, type ThemeChoice } from "@/lib/theme";

export interface NavLink {
  href: string;
  label: string;
}

const THEME_ORDER: ThemeChoice[] = ["light", "dark", "system"];

/** The one global website language selector (EN/ID), persisted via LangProvider. */
function LanguageSelector() {
  const { language, setLanguage } = useLang();
  const t = getStrings(language);
  // Scoped per instance: desktop and mobile selectors can coexist.
  const pillId = `oc-lang-pill-${useId()}`;
  return (
    <div
      role="radiogroup"
      aria-label={t.languageLabel}
      className="inline-flex h-9 items-center rounded-md border border-edge p-0.5"
    >
      {UI_LANGUAGES.map((entry) => {
        const selected = language === entry.code;
        return (
          <button
            key={entry.code}
            type="button"
            role="radio"
            aria-checked={selected}
            title={entry.label}
            aria-label={entry.label}
            onClick={() => setLanguage(entry.code)}
            className={`relative h-7 cursor-pointer rounded px-2 text-xs font-medium ${
              selected
                ? "font-semibold text-navy"
                : "text-muted hover:bg-brand-soft hover:text-ink"
            }`}
          >
            {selected && <ActivePill pillId={pillId} />}
            <span className="relative">{entry.code.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}

function ThemeSwitcher() {
  const { choice, setChoice } = useTheme();
  const { language } = useLang();
  const t = getStrings(language);
  const labels: Record<ThemeChoice, string> = {
    light: t.themeLight,
    dark: t.themeDark,
    system: t.themeSystem,
  };
  const next = THEME_ORDER[(THEME_ORDER.indexOf(choice) + 1) % THEME_ORDER.length]!;
  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={format(t.headerThemeAria, { current: labels[choice], next: labels[next] })}
      title={format(t.headerThemeTitle, { current: labels[choice] })}
      className="inline-flex h-9 cursor-pointer items-center rounded-md border border-edge px-3 text-sm font-medium hover:bg-brand-soft"
    >
      {labels[choice]}
    </button>
  );
}

function AccountMenu() {
  const { user, signOutUser } = useAuth();
  const { language } = useLang();
  const t = getStrings(language);
  const [open, setOpen] = useState(false);
  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center rounded-md bg-brand px-4 text-sm font-medium text-on-action hover:bg-brand-strong"
      >
        {t.headerSignIn}
      </Link>
    );
  }
  const label = user.displayName || user.email || t.headerAccountFallback;
  return (
    <details className="relative" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-md border border-edge px-3 text-sm font-medium hover:bg-brand-soft [&::-webkit-details-marker]:hidden">
        {label.length > 24 ? `${label.slice(0, 24)}…` : label}
      </summary>
      {open && (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: OC_DURATION.fast, ease: OC_EASE }}
        className="absolute right-0 z-40 mt-2 w-52 rounded-md border border-edge bg-card p-1 shadow-[0_4px_12px_rgba(23,59,112,0.12)]"
      >
        <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
        <Link
          href="/workspace"
          className="block rounded px-3 py-2 text-sm hover:bg-brand-soft"
        >
          {t.headerWorkspace}
        </Link>
        <Link
          href="/workspace/settings"
          className="block rounded px-3 py-2 text-sm hover:bg-brand-soft"
        >
          {t.headerSettings}
        </Link>
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="block w-full cursor-pointer rounded px-3 py-2 text-left text-sm hover:bg-brand-soft"
        >
          {t.headerSignOut}
        </button>
      </motion.div>
      )}
    </details>
  );
}

function isActiveLink(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopLinks({ links, pathname }: { links: NavLink[]; pathname: string | null }) {
  return (
    <>
      {links.map((link) => {
        const active = pathname !== null && isActiveLink(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-md px-3 py-2 text-sm font-medium ${
              active ? "font-semibold text-navy" : "hover:bg-brand-soft"
            }`}
          >
            {active && <ActivePill pillId="oc-header-nav" />}
            <span className="relative">{link.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function DesktopNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const { language } = useLang();
  const t = getStrings(language);
  return (
    <nav aria-label={t.headerPrimaryAria} className="hidden items-center gap-1 md:flex">
      <DesktopLinks links={links} pathname={pathname} />
    </nav>
  );
}

function MobileLinks({
  links,
  pathname,
  onNavigate,
}: {
  links: NavLink[];
  pathname: string | null;
  onNavigate: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname !== null && isActiveLink(pathname, link.href);
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-brand-soft font-semibold text-navy" : "hover:bg-brand-soft"
              }`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function MobileNav({ links, onNavigate }: { links: NavLink[]; onNavigate: () => void }) {
  const pathname = usePathname();
  return <MobileLinks links={links} pathname={pathname} onNavigate={onNavigate} />;
}

export default function AppHeader({ links }: { links: NavLink[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { language } = useLang();
  const t = getStrings(language);
  const closeMenu = () => setMenuOpen(false);
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-card">
      <a href="#main-content" className="skip-link">
        {t.headerSkipLink}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-navy"
          aria-label={t.headerHomeAria}
        >
          OpporCheck
        </Link>
        <Suspense
          fallback={
            <nav aria-label={t.headerPrimaryAria} className="hidden items-center gap-1 md:flex">
              <DesktopLinks links={links} pathname={null} />
            </nav>
          }
        >
          <DesktopNav links={links} />
        </Suspense>
        <div className="hidden items-center gap-2 md:flex">
          <LanguageSelector />
          <ThemeSwitcher />
          <AccountMenu />
        </div>
        {links.length > 0 && (
          <button
            type="button"
            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-edge px-3 text-sm font-medium md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? t.commonClose : t.commonMenu}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.nav
            id="mobile-nav"
            aria-label={t.headerMobileAria}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
            className="overflow-hidden border-t border-edge bg-card md:hidden"
          >
            <div className="px-4 py-3">
              <Suspense fallback={<MobileLinks links={links} pathname={null} onNavigate={closeMenu} />}>
                <MobileNav links={links} onNavigate={closeMenu} />
              </Suspense>
              <div className="mt-2 flex items-center gap-2 border-t border-edge pt-3">
                <LanguageSelector />
                <ThemeSwitcher />
                <AccountMenu />
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
