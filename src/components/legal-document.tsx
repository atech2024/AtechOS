import { cookies } from 'next/headers'
import { translate } from '@/lib/translations'
import { MarketingFooter, MarketingHeader } from '@/components/marketing-chrome'
import { landingCopyFor } from '@/lib/landing-content'
import { localeFrom } from '@/lib/i18n'

type LegalSection = { title: string; body: string }

export async function LegalDocument({ title, introduction, sections }: {
  title: string
  introduction: string
  sections: LegalSection[]
}) {
  const locale = localeFrom((await cookies()).get('atechos_locale')?.value)
  const copy = landingCopyFor(locale)

  return (
    <main className="landing">
      <MarketingHeader copy={copy} />
      <section className="landing-section">
        <article className="landing-frame legal-document">
          <p className="legal-document__status">{translate("Draft for review — not a final policy.", locale)}</p>
          <h1>{translate(title, locale)}</h1>
          <p className="legal-document__intro">{translate(introduction, locale)}</p>
          {sections.map((section) => (
            <section className="legal-document__section" key={section.title}>
              <h2>{translate(section.title, locale)}</h2>
              <p>{translate(section.body, locale)}</p>
            </section>
          ))}
        </article>
      </section>
      <MarketingFooter copy={copy} />
    </main>
  )
}
