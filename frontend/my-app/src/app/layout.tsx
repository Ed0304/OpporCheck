import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import DocumentLang from "@/components/DocumentLang";
import { MotionProvider } from "@/components/motion";
import { ThemeProvider } from "@/lib/theme";
import { LangProvider } from "@/lib/lang";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpporCheck",
  description: "Review overseas job opportunities with evidence and clear explanations.",
};

// Applies the saved theme before first paint (no flash on reload).
const themeScript = `(function(){try{var t=localStorage.getItem("oc-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

// Applies the saved UI language before first paint so <html lang> matches
// the preference from the start; DocumentLang keeps it in sync afterwards.
const langScript = `(function(){try{document.documentElement.lang=localStorage.getItem("oc-lang")==="id"?"id":"en";}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: langScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LangProvider>
            <DocumentLang />
            <MotionProvider>
              <AuthProvider>{children}</AuthProvider>
            </MotionProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
