import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "App Citas - By KR System",
  description: "Agenda y reservas para negocios de servicios — App Citas",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "App Citas",
  },
};

// Deliberately has no session/branding logic — this wraps EVERY route,
// including the public /book/[subdomain] booking page, which must never
// show a signed-in owner's nav bar or colors just because they happen to
// have an active session in the same browser. Authenticated pages get their
// nav bar and brand colors from app/(app)/layout.tsx instead; the public
// booking page applies a business's colors itself, scoped to its own markup
// (see app/book/[subdomain]/page.tsx).
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
