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
  return { title: copy.pages.solutionsTitle + ' | AtechOS', description: copy.pages.solutionsDescription }
}

export default async function SolutionsPage() {
  const copy = await getCopy()
  return <main className="landing">
    <a className="landing-skip-link" href="#solutions-content">{copy.navigation.skipToContent}</a>
    <MarketingHeader copy={copy} />
    <section id="solutions-content" tabIndex={-1} className="landing-subpage-hero">
      <div className="landing-frame" data-landing-reveal>
        <p className="landing-subpage-eyebrow">AtechOS</p>
        <h1>{copy.pages.solutionsTitle}</h1>
        <p className="landing-subpage-lede">{copy.pages.solutionsDescription}</p>
      </div>
    </section>
    <section className="landing-section landing-subpage-content">
      <div className="landing-frame landing-subpage-roles">
        {copy.roles.map(item => <article className="landing-role-row" key={item.audience} data-landing-reveal>
          <span className="landing-role-row__audience">{item.audience}</span>
          <div className="landing-role-row__text"><h2>{item.title}</h2><p>{item.description}</p></div>
        </article>)}
      </div>
    </section>
    <section className="landing-closing"><div className="landing-frame landing-closing__inner" data-landing-reveal>
      <div><h2>{copy.closing.title}</h2><p>{copy.closing.description}</p></div>
      <div className="landing-actions"><Link href="/signup" className="landing-button landing-button--light">{copy.closing.primary}<ArrowRight size={18} aria-hidden="true" /></Link><Link href="/signin" className="landing-button landing-button--closing-secondary">{copy.closing.secondary}</Link></div>
    </div></section>
    <MarketingFooter copy={copy} />
  </main>
}
