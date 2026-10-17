import type { Metadata } from 'next'
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
  Check,
} from 'lucide-react'
import { landingCopyFor } from '@/lib/landing-content'
import { MarketingFooter, MarketingHeader } from '@/components/marketing-chrome'
import { localeFrom } from '@/lib/i18n'

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
  const DashboardIcon = iconByName.school

  return (
    <main id="main-content" className="landing" tabIndex={-1}>
      <a className="landing-skip-link" href="#landing-hero">{copy.navigation.skipToContent}</a>
      <MarketingHeader copy={copy} home />
        <div className="landing-frame landing-header__inner">
          <Link href="/" className="landing-brand" aria-label="AtechOS">
            <span className="landing-brand__mark"><GraduationCap size={25} strokeWidth={2.2} aria-hidden="true" /></span>
            <span className="landing-brand__copy"><strong>AtechOS</strong><small>{copy.brand.subtitle}</small></span>
          </Link>
          <nav className="landing-nav" aria-label={copy.navigation.aria}>
            <a href="#fonctionnalites">{copy.navigation.features}</a>
            <a href="#roles">{copy.navigation.roles}</a>
          </nav>
          <div className="landing-header__actions">
            <Link href="/signin" className="landing-signin">{copy.navigation.signIn}</Link>
            <Link href="/signup" className="landing-button landing-button--nav">{copy.navigation.createSchool}<ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      

      <section id="landing-hero" className="landing-hero" tabIndex={-1}>
        <div className="landing-frame landing-hero__inner">
          <div className="landing-hero__copy">
            <h1>{copy.hero.title}<span>{copy.hero.emphasis}</span></h1>
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

          <div className="landing-visual">
            <div className="landing-visual__label">{copy.hero.previewTitle}</div>
            <div className="landing-mockup" role="img" aria-label={copy.hero.previewAlt}>
              <div className="landing-mockup__topbar">
                <div className="landing-window-dots" aria-hidden="true"><i /><i /><i /></div>
                <span>AtechOS</span>
                <span className="landing-mockup__context">{copy.hero.previewContext}</span>
              </div>
              <div className="landing-mockup__body">
                <aside className="landing-mockup__side">
                  <span className="landing-mockup__brand"><DashboardIcon size={16} aria-hidden="true" /> AtechOS</span>
                  {copy.hero.previewNav.map((label, index) => (
                    <span key={label} className={index === 0 ? 'is-active' : ''}>{label}</span>
                  ))}
                </aside>
                <div className="landing-mockup__main">
                  <div className="landing-mockup__heading">
                    <div><span>{copy.brand.subtitle}</span><h2>{copy.hero.previewTitle}</h2></div>
                    <span className="landing-mockup__school-mark" aria-hidden="true"><Check size={15} /></span>
                  </div>
                  <div className="landing-mockup__rows">
                    {copy.hero.previewItems.map(item => {
                      const Icon = iconByName[item.icon]
                      return <div className="landing-mockup__row" key={item.title}>
                        <span className="landing-mockup__icon"><Icon size={18} aria-hidden="true" /></span>
                        <span className="landing-mockup__row-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                        <ArrowRight size={15} className="landing-mockup__arrow" aria-hidden="true" />
                      </div>
                    })}
                  </div>
                </div>
              </div>
            </div>
            <p className="landing-visual__caption">{copy.hero.previewCaption}</p>
          </div>
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
          {copy.roles.map(item => {
            const Icon = iconByName[item.icon]
            return <article className="landing-role-row" key={item.audience} data-landing-reveal>
              <span className="landing-role-row__audience">{item.audience}</span>
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
