import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cookies } from 'next/headers'
import { landingCopyFor } from '@/lib/landing-content'
import { localeFrom } from '@/lib/i18n'
import { MarketingFooter, MarketingHeader } from '@/components/marketing-chrome'

async function getCopy() {
  const value = (await cookies()).get('atechos_locale')?.value
  return landingCopyFor(localeFrom(value))
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = await getCopy()
  return { title: copy.pages.featuresTitle + ' | AtechOS', description: copy.pages.featuresDescription }
}

export default async function FeaturesPage() {
  const copy = await getCopy()
  return <main className="landing">
    <a className="landing-skip-link" href="#features-content">{copy.navigation.skipToContent}</a>
    <MarketingHeader copy={copy} />
    <section id="features-content" tabIndex={-1} className="landing-subpage-hero">
      <div className="landing-frame">
        <p className="landing-subpage-eyebrow">AtechOS</p>
        <h1>{copy.pages.featuresTitle}</h1>
        <p className="landing-subpage-lede">{copy.pages.featuresDescription}</p>
      </div>
    </section>
    <section className="landing-section landing-subpage-content">
      <div className="landing-frame">
        <ul className="landing-module-list">
          {copy.modules.items.map(item => <li key={item.title}>
            <div><h2>{item.title}</h2><p>{item.description}</p></div>
            <ArrowRight size={18} className="landing-module-list__arrow" aria-hidden="true" />
          </li>)}
        </ul>
      </div>
    </section>
    <section className="landing-closing"><div className="landing-frame landing-closing__inner">
      <div><h2>{copy.closing.title}</h2><p>{copy.closing.description}</p></div>
      <div className="landing-actions"><Link href="/signup" className="landing-button landing-button--light">{copy.closing.primary}<ArrowRight size={18} aria-hidden="true" /></Link><Link href="/signin" className="landing-button landing-button--closing-secondary">{copy.closing.secondary}</Link></div>
    </div></section>
    <MarketingFooter copy={copy} />
  </main>
}
