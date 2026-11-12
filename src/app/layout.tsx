import type { Metadata } from "next";
import "./globals.css";
import { cookies } from 'next/headers';
import GlobalLanguage from '@/components/global-language';
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
      <body><TranslationProvider locale={locale}><GlobalLanguage locale={locale} />{children}</TranslationProvider></body>
    </html>
  );
}
