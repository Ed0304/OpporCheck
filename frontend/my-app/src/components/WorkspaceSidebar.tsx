"use client";

// Contextual workspace sidebar: collapsible on desktop, drawer on mobile.
// Collapse state persists for the session; Escape closes the drawer.
// Labels follow the global website language preference. The two-letter
// collapsed-rail shorts stay fixed (decorative; the full localized label
// is always exposed to assistive technology).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ActivePill, OC_DURATION, OC_EASE } from "@/components/motion";
import { useLang } from "@/lib/lang";
import { getStrings, type UiLanguage } from "@/lib/strings";

export interface WorkspaceNavItem {
  href: string;
  label: string;
  short: string;
}

export function getWorkspaceNav(language: UiLanguage): WorkspaceNavItem[] {
  const t = getStrings(language);
  return [
    { href: "/workspace", label: t.wsNavOverview, short: "Ov" },
    { href: "/workspace/compare", label: t.wsNavCompare, short: "PP" },
    { href: "/workspace/comparisons", label: t.wsNavComparisons, short: "Sa" },
    { href: "/workspace/review", label: t.wsNavReview, short: "Re" },
    { href: "/workspace/investigations", label: t.wsNavInvestigations, short: "In" },
    { href: "/workspace/resources", label: t.wsNavResources, short: "Rs" },
    { href: "/workspace/settings", label: t.wsNavSettings, short: "Se" },
  ];
}

/** English default, kept for existing imports; UI code prefers getWorkspaceNav. */
export const WORKSPACE_NAV: WorkspaceNavItem[] = getWorkspaceNav("en");

function isActive(pathname: string, href: string): boolean {
  if (href === "/workspace") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceSidebar({
  collapsed,
  onToggleCollapse,
  drawerOpen,
  onCloseDrawer,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const pathname = usePathname();
  const { language } = useLang();
  const t = getStrings(language);
  const nav = getWorkspaceNav(language);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseDrawer();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, onCloseDrawer]);

  const list = (onNavigate?: () => void, slim = false, pillId = "oc-ws-nav") => (
    <ul className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={slim ? item.label : undefined}
              className={`relative block rounded-lg px-3 py-2 text-sm transition-colors duration-150 ease-out ${
                active
                  ? "font-semibold text-navy"
                  : "text-muted hover:bg-brand-soft hover:text-ink"
              } ${slim ? "text-center" : ""}`}
            >
              {active && <ActivePill pillId={pillId} className="bg-gradient-to-r from-brand-soft to-transparent shadow-sm" />}
              <span className="relative">
                {slim ? <span aria-hidden>{item.short}</span> : item.label}
              </span>
              {slim && <span className="sr-only">{item.label}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Desktop: collapsible rail. Deliberately dimmer than the canvas
          so navigation recedes once the user reaches their desk. */}
      <motion.aside
        aria-label={t.wsSidebarAria}
        initial={false}
        animate={{ width: collapsed ? "4.5rem" : "15.5rem" }}
        transition={{ duration: OC_DURATION.base, ease: OC_EASE }}
        className="oc-glass-rail hidden shrink-0 flex-col self-start overflow-hidden rounded-xl border border-rail-edge lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100vh-6rem)]"
      >
        <div className="flex-1 p-2.5">
          {!collapsed && (
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
              {t.wsSidebarAria}
            </p>
          )}
          <nav aria-label={t.wsSectionsAria}>{list(undefined, collapsed)}</nav>
          {!collapsed && (
            <nav aria-label={t.wsSiteNavAria} className="mt-2 border-t border-rail-edge pt-2">
              <ul className="flex flex-col gap-0.5">
                {[
                  { href: "/about", label: t.navAbout },
                  { href: "/how-it-works", label: t.navHowItWorks },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 ease-out hover:bg-brand-soft hover:text-ink"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <div className="border-t border-rail-edge p-2.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            title={collapsed ? t.wsExpand : t.wsCollapse}
            className={`w-full cursor-pointer rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 ease-out hover:bg-brand-soft hover:text-ink ${collapsed ? "text-center" : "text-left"}`}
          >
            {collapsed ? (
              <>
                <span aria-hidden>→</span>
                <span className="sr-only">{t.wsExpand}</span>
              </>
            ) : (
              <>
                <span aria-hidden>← </span>
                {t.wsCollapse}
              </>
            )}
          </button>
        </div>
      </motion.aside>

      {/* Mobile: drawer */}
      <AnimatePresence initial={false}>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t.wsMenuButton}>
            <motion.button
              type="button"
              aria-label={t.wsCloseMenuAria}
              onClick={onCloseDrawer}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: OC_DURATION.fast, ease: OC_EASE }}
              className="absolute inset-0 h-full w-full cursor-default bg-black/40"
            />
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: OC_DURATION.panel, ease: OC_EASE }}
              className="oc-glass-rail absolute left-0 top-0 flex h-full w-72 flex-col gap-3 overflow-y-auto border-r border-rail-edge p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                  {t.wsSidebarAria}
                </p>
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  autoFocus
                  className="cursor-pointer rounded-md border border-edge px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out hover:bg-brand-soft"
                >
                  {t.commonClose}
                </button>
              </div>
              <nav aria-label={t.wsSectionsAria}>{list(onCloseDrawer, false, "oc-ws-drawer")}</nav>
              <nav aria-label={t.wsSiteNavAria} className="border-t border-rail-edge pt-3">
                <ul className="flex flex-col gap-0.5">
                  {[
                    { href: "/about", label: t.navAbout },
                    { href: "/how-it-works", label: t.navHowItWorks },
                  ].map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseDrawer}
                        className="block rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 ease-out hover:bg-brand-soft hover:text-ink"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
