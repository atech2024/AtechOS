import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookOpenCheck, CalendarDays, CircleDollarSign, GraduationCap, MessageSquareText, UsersRound } from 'lucide-react'
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

const moduleIcons = {
  students: UsersRound,
  attendance: CalendarDays,
  results: GraduationCap,
  finance: CircleDollarSign,
  calendar: CalendarDays,
  communication: MessageSquareText,
  school: BookOpenCheck,
  teaching: GraduationCap,
  family: UsersRound,
}

const roleImages = ['/landing/atechos-direction.webp', '/landing/atechos-enseignants.webp', '/landing/atechos-familles.webp']

export default async function FeaturesPage() {
  const copy = await getCopy()
  return <main className="landing">
    <a className="landing-skip-link" href="#features-content">{copy.navigation.skipToContent}</a>
    <MarketingHeader copy={copy} />
    <section id="features-content" tabIndex={-1} className="landing-subpage-hero">
      <div className="landing-frame" data-landing-reveal>
        <p className="landing-subpage-eyebrow">AtechOS</p>
        <h1>{copy.pages.featuresTitle}</h1>
        <p className="landing-subpage-lede">{copy.pages.featuresDescription}</p>
      </div>
    </section>
    <section className="landing-section landing-subpage-content" aria-label={copy.navigation.roles}>
      <div className="landing-frame landing-subpage-roles">
        {copy.roles.map((item, index) => (
          <article className="landing-role-row landing-role-row--solution" key={item.audience} data-landing-reveal>
            <span className="landing-role-row__audience">{item.audience}</span>
            <figure className="landing-role-row__figure">
              <Image
                className="landing-role-row__image"
                src={roleImages[index] ?? roleImages[0]}
                alt={copy.visuals.roleAlts[index] ?? copy.visuals.conceptLabel}
                width={1448}
                height={1086}
                sizes="(max-width: 700px) 100vw, (max-width: 960px) 34vw, 24vw"
                loading="lazy"
              />
              <figcaption>{copy.visuals.conceptLabel}</figcaption>
            </figure>
            <div className="landing-role-row__text"><h2>{item.title}</h2><p>{item.description}</p></div>
          </article>
        ))}
      </div>
    </section>
    <section className="landing-section landing-subpage-content">
      <div className="landing-frame">
        <figure className="landing-workflow-visual" data-landing-reveal>
          <Image
            src="/landing/atechos-workflow.webp"
            alt={copy.visuals.workflowAlt}
            width={1586}
            height={992}
            sizes="(max-width: 700px) 100vw, 1050px"
            loading="lazy"
          />
          <figcaption><span>{copy.visuals.conceptLabel}</span>{copy.visuals.workflowCaption}</figcaption>
        </figure>
        <div className="landing-modules__heading" data-landing-reveal>
          <h2>{copy.modules.title}</h2>
          <p>{copy.modules.description}</p>
        </div>
        <ul className="landing-module-list">
          {copy.modules.items.map(item => {
            const Icon = moduleIcons[item.icon]
            return <li key={item.title} data-landing-reveal>
              <span className="landing-module-list__icon"><Icon size={18} aria-hidden="true" /></span>
              <div><h3>{item.title}</h3><p>{item.description}</p></div>
              <ArrowRight size={18} className="landing-module-list__arrow" aria-hidden="true" />
            </li>
          })}
        </ul>
      </div>
    </section>
    <section className="landing-closing"><div className="landing-frame landing-closing__inner" data-landing-reveal>
      <div><h2>{copy.closing.title}</h2><p>{copy.closing.description}</p></div>
      <div className="landing-actions"><Link href="/signup" className="landing-button landing-button--light">{copy.closing.primary}<ArrowRight size={18} aria-hidden="true" /></Link><Link href="/signin" className="landing-button landing-button--closing-secondary">{copy.closing.secondary}</Link></div>
    </div></section>
    <MarketingFooter copy={copy} />
  </main>
}
