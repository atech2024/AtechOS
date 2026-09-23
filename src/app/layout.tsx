import type { Metadata } from "next";
import "./globals.css";
import { cookies } from 'next/headers';
import LanguageSelector from '@/components/language-selector';
import { localeFrom } from '@/lib/i18n';
import { TranslationProvider } from '@/components/translation-provider';

export const metadata: Metadata = {
  title: "AtechOS",
  description: "The Operating System for Schools",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = localeFrom((await cookies()).get('atechos_locale')?.value)
  return (
    <html lang={locale}>
      <body><TranslationProvider locale={locale}><div className="fixed right-3 top-3 z-50"><LanguageSelector locale={locale} /></div>{children}</TranslationProvider></body>
    </html>
  );
}
