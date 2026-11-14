// Shared shell for public pages: top navigation, main landmark, footer.

import AppHeader, { type NavLink } from "./AppHeader";
import SiteFooter from "./SiteFooter";

export const PUBLIC_LINKS: NavLink[] = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/resources", label: "Resources" },
];

export default function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppHeader links={PUBLIC_LINKS} />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
