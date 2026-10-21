import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { cookies } from 'next/headers'
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CircleDollarSign,
  GraduationCap,
  MessageSquareText,
  School,
  ShieldCheck,
  UsersRound,
  UserRoundCheck,
  ClipboardList,
} from 'lucide-react'
import { landingCopyFor } from '@/lib/landing-content'
import { MarketingFooter, MarketingHeader } from '@/components/marketing-chrome'
import { localeFrom } from '@/lib/i18n'
import { LandingHeroMedia } from '@/components/landing-hero-media'

const iconByName = {
  school: School,
  teaching: BookOpenCheck,
  family: UsersRound,
  students: GraduationCap,
  attendance: UserRoundCheck,
  results: ClipboardList,
  finance: CircleDollarSign,
  calendar: CalendarDays,
  communication: MessageSquareText,
} as const

async function currentLocale() {
  const locale = (await cookies()).get('atechos_locale')?.value
  return localeFrom(locale)
}

export async function generateMetadata(): Promise<Metadata> {
  const copy = landingCopyFor(await currentLocale())
  return { title: copy.metadata.title, description: copy.metadata.description }
}

export default async function Home() {
  const copy = landingCopyFor(await currentLocale())

  return (
    <main id="main-content" className="landing" tabIndex={-1}>
      <a className="landing-skip-link" href="#landing-hero">{copy.navigation.skipToContent}</a>
      <MarketingHeader copy={copy} home />
      <section id="landing-hero" className="landing-hero" tabIndex={-1}>
        <div className="landing-frame landing-hero__inner">
          <div className="landing-hero__copy">
            <h1><span className="landing-hero__title-line">{copy.hero.title}</span><span className="landing-hero__emphasis-line">{copy.hero.emphasis}</span></h1>
            <p>{copy.hero.description}</p>
            <div className="landing-actions">
              <Link href="/signup" className="landing-button landing-button--primary">{copy.hero.primary}<ArrowRight size={18} aria-hidden="true" /></Link>
              <Link href="/signin" className="landing-button landing-button--secondary">{copy.hero.secondary}</Link>
            </div>
            <div className="landing-hero__principles" aria-label={copy.modules.items.slice(0, 4).map(item => item.title).join(' · ')}>
              {copy.modules.items.slice(0, 4).map((item, index) => (
                <span key={item.title}>{index > 0 && <i aria-hidden="true" />}{item.title}</span>
              ))}
            </div>
          </div>

          <LandingHeroMedia imageAlt={copy.visuals.heroAlt} caption={copy.visuals.heroCaption} label={copy.visuals.conceptLabel} />
        </div>
      </section>

      <div className="landing-ribbon" aria-hidden="true">
        <div className="landing-frame landing-ribbon__inner">
          <span>{copy.modules.items[0].title}</span><i /><span>{copy.modules.items[1].title}</span><i /><span>{copy.modules.items[2].title}</span><i /><span>{copy.modules.items[3].title}</span>
        </div>
      </div>

      <section id="roles" className="landing-section landing-introduction">
        <div className="landing-frame landing-introduction__grid" data-landing-reveal>
          <h2>{copy.introduction.title}</h2>
          <p>{copy.introduction.description}</p>
        </div>
      </section>

      <section className="landing-roles" aria-label={copy.navigation.roles}>
        <div className="landing-frame">
          {copy.roles.map((item, index) => {
            const Icon = iconByName[item.icon]
            const roleImages = ['/landing/atechos-direction.webp', '/landing/atechos-enseignants.webp', '/landing/atechos-familles.webp']
            return <article className="landing-role-row" key={item.audience} data-landing-reveal>
              <span className="landing-role-row__audience">{item.audience}</span>
              <Image className="landing-role-row__image" src={roleImages[index] ?? roleImages[0]} alt={copy.visuals.roleAlts[index] ?? copy.visuals.conceptLabel} width={1448} height={1086} sizes="(max-width: 700px) 100vw, (max-width: 960px) 34vw, 24vw" loading="lazy" />
              <div className="landing-role-row__text"><h3>{item.title}</h3><p>{item.description}</p></div>
              <span className="landing-role-row__icon"><Icon size={24} strokeWidth={1.7} aria-hidden="true" /></span>
            </article>
          })}
        </div>
      </section>

      <section id="fonctionnalites" className="landing-section landing-modules">
        <div className="landing-frame">
          <div className="landing-modules__heading" data-landing-reveal>
            <h2>{copy.modules.title}</h2>
            <p>{copy.modules.description}</p>
          </div>
          <figure className="landing-workflow-visual" data-landing-reveal>
            <Image src="/landing/atechos-workflow.webp" alt={copy.visuals.workflowAlt} width={1586} height={992} sizes="(max-width: 700px) 100vw, 1100px" loading="lazy" />
            <figcaption><span>{copy.visuals.conceptLabel}</span>{copy.visuals.workflowCaption}</figcaption>
          </figure>
          <ul className="landing-module-list">
            {copy.modules.items.map(item => {
              const Icon = iconByName[item.icon]
              return <li key={item.title} data-landing-reveal>
                <span className="landing-module-list__icon"><Icon size={20} aria-hidden="true" /></span>
                <div><h3>{item.title}</h3><p>{item.description}</p></div>
                <ArrowRight size={18} className="landing-module-list__arrow" aria-hidden="true" />
              </li>
            })}
          </ul>
        </div>
      </section>

      <section id="access" className="landing-access">
        <div className="landing-frame landing-access__inner" data-landing-reveal>
          <span className="landing-access__icon"><ShieldCheck size={28} strokeWidth={1.7} aria-hidden="true" /></span>
          <div><h2>{copy.access.title}</h2><p>{copy.access.description}</p></div>
        </div>
      </section>

      <section className="landing-closing">
        <div className="landing-frame landing-closing__inner" data-landing-reveal>
          <div><h2>{copy.closing.title}</h2><p>{copy.closing.description}</p></div>
          <div className="landing-actions">
            <Link href="/signup" className="landing-button landing-button--light">{copy.closing.primary}<ArrowRight size={18} aria-hidden="true" /></Link>
            <Link href="/signin" className="landing-button landing-button--closing-secondary">{copy.closing.secondary}</Link>
          </div>
        </div>
      </section>

      <MarketingFooter copy={copy} />
    </main>
  )
}
