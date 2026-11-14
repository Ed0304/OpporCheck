// Public footer: links to real pages only. No fabricated legal pages.

import Link from "next/link";

const COLUMNS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: "Product",
    links: [
      { href: "/about", label: "About OpporCheck" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/resources", label: "Employment guidance" },
    ],
  },
  {
    heading: "Workspace",
    links: [
      { href: "/workspace/review", label: "Review an opportunity" },
      { href: "/workspace/investigations", label: "My investigations" },
      { href: "/hybrid-demo", label: "Model playground" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
      { href: "/workspace/settings", label: "Settings" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-edge bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        {COLUMNS.map((column) => (
          <nav key={column.heading} aria-label={`Footer: ${column.heading}`}>
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
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-muted sm:px-6">
          OpporCheck helps you review overseas job opportunities with evidence and clear
          explanations. It does not verify employers and is not legal advice.
        </p>
      </div>
    </footer>
  );
}
