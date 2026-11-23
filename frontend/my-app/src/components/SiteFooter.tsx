// Public footer: links to real pages only. No fabricated legal pages.
// Carries the full canonical disclaimer.

"use client";

import Link from "next/link";
import { getFullDisclaimerParagraphs } from "@/lib/disclaimer";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/lang";
import { format, getStrings } from "@/lib/strings";

export default function SiteFooter() {
  const { language } = useLang();
  const { user } = useAuth();
  const t = getStrings(language);
  const paragraphs = getFullDisclaimerParagraphs(language);
  const columns: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
    {
      heading: t.footerProduct,
      links: [
        { href: "/about", label: t.footerAbout },
        { href: "/how-it-works", label: t.footerHowItWorks },
        { href: "/resources", label: t.footerGuidance },
      ],
    },
    {
      heading: t.footerWorkspace,
      links: [
        { href: "/workspace/review", label: t.footerReview },
        { href: "/workspace/compare", label: t.wsNavCompare },
        { href: "/workspace/investigations", label: t.footerInvestigations },
        { href: "/hybrid-demo", label: t.footerPlayground },
      ],
    },
    {
      heading: t.footerAccount,
      links: user
        ? [
            { href: "/workspace", label: t.headerWorkspace },
            { href: "/workspace/investigations", label: t.footerInvestigations },
            { href: "/workspace/settings", label: t.footerSettings },
          ]
        : [
            { href: "/login", label: t.footerSignIn },
            { href: "/register", label: t.footerCreateAccount },
            { href: "/workspace/settings", label: t.footerSettings },
          ],
    },
  ];
  return (
    <footer className="oc-glass-strong border-t border-edge">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        {columns.map((column) => (
          <nav
            key={column.heading}
            aria-label={format(t.footerNavAria, { heading: column.heading })}
          >
            <h2 className="text-sm font-semibold">{column.heading}</h2>
            <ul className="mt-2 flex flex-col gap-1">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-edge">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <p className="text-sm font-semibold">{t.footerNoticeHeading}</p>
          {paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="mt-1 text-sm leading-6 text-muted">
              {paragraph}
            </p>
          ))}
          <p className="mt-2 text-sm text-muted">{t.footerTagline}</p>
        </div>
      </div>
    </footer>
  );
}
