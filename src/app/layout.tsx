import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-context";
import { PwaProvider } from "@/components/pwa-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "BnaaSaaS",
  description:
    "Plateforme de gestion de projets genie civil pour suivi de chantier, documents et finance.",
  applicationName: "BnaaSaaS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col soft-scrollbar">
        <PwaProvider>
          <AuthProvider>{children}</AuthProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
