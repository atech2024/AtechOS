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

const launchPrices = [
  ['1 950 HTG', '15 USD', '19 500 HTG', '150 USD'],
  ['3 250 HTG', '25 USD', '32 500 HTG', '250 USD'],
  ['4 550 HTG', '35 USD', '45 500 HTG', '350 USD'],
] as const

const pricingCopy = {
  "fr": [
    "Prix de lancement par établissement, jusqu’à 150 élèves actifs.",
    "Par mois",
    "Par an",
    "L’abonnement annuel coûte l’équivalent de 10 mois. Au-delà de 150 élèves, le prix est établi sur devis.",
    "La devise (HTG ou USD) est choisie avant la facturation. Le montant reste fixe sur la facture. Matériel KIOS, impression de badges et installation sur place font l’objet d’un devis séparé si nécessaire.",
    "Ouverture de l’essai à venir. Aucun paiement automatique pendant l’essai."
  ],
  "ht": [
    "Pri lansman pou chak lekòl, jiska 150 elèv aktif.",
    "Pa mwa",
    "Pa ane",
    "Abònman anyèl la koute menm pri ak 10 mwa. Pou plis pase 150 elèv, pri a sou devis.",
    "Lekòl la chwazi HTG oswa USD anvan fakti a soti. Montan an rete fiks sou fakti a. Si sa nesesè, ekipman KIOS, enpresyon badj ak enstalasyon sou plas gen yon devis apa.",
    "Esè a ap disponib pita. Pa gen peman otomatik pandan esè a."
  ],
  "en": [
    "Launch pricing per school, up to 150 active students.",
    "Monthly",
    "Yearly",
    "A yearly subscription costs the equivalent of 10 months. Schools with more than 150 students receive a quote.",
    "Choose HTG or USD before invoicing. The invoice amount stays fixed. KIOS hardware, badge printing and on-site installation are quoted separately if needed.",
    "Trial opening to be announced. No automatic payment during the trial."
  ]
}

const schoolPlans = {
  "fr": {
    "title": "Trois offres pour votre école",
    "trial": "Essayez l’offre de votre choix pendant 30 jours",
    "note": "Pendant l’essai, accédez à toutes les fonctions de l’offre choisie. Changez d’offre en cours d’essai en gardant la même date de fin. À l’échéance, choisissez votre abonnement. Vos données restent consultables et les modules non inclus passent en lecture seule.",
    "plans": [
      [
        "Présences",
        "L’offre la plus accessible pour suivre les entrées, sorties et retards avec KIOS."
      ],
      [
        "École",
        "Tout le plan Présences, plus classes, devoirs, examens, notes, bulletins et portails."
      ],
      [
        "École + Finance",
        "Tout le plan École, plus échéances, suivi des paiements, reçus et remboursements."
      ]
    ]
  },
  "ht": {
    "title": "Twa plan pou lekòl ou",
    "trial": "Eseye nenpòt plan pandan 30 jou",
    "note": "Pandan esè a, ou jwenn tout fonksyon plan ou chwazi a. Ou ka chanje plan pandan esè a pandan menm dat fen an rete valab. Lè esè a fini, chwazi abònman ou. Done ou yo rete disponib pou konsilte, epi modil ki pa nan abònman an pase an lekti sèlman.",
    "plans": [
      [
        "Prezans",
        "Plan ki pi abòdab la pou swiv antre, sòti ak reta avèk KIOS."
      ],
      [
        "Lekòl",
        "Tout sa ki nan Prezans, plis klas, devwa, egzamen, nòt, bilten ak pòtal."
      ],
      [
        "Lekòl + Finans",
        "Tout sa ki nan Lekòl, plis échéance, swivi peman, resi ak ranbousman."
      ]
    ]
  },
  "en": {
    "title": "Three plans for your school",
    "trial": "Try any plan for 30 days",
    "note": "During the trial, use every feature in your chosen plan. You can switch plans and keep the same end date. At the end, choose a subscription. Your data remains available to view, and modules outside your subscription become read-only.",
    "plans": [
      [
        "Attendance",
        "The most affordable plan for KIOS check-ins, check-outs and lateness."
      ],
      [
        "School",
        "Everything in Attendance, plus classes, assignments, exams, grades, report cards and portals."
      ],
      [
        "School + Finance",
        "Everything in School, plus installments, payment tracking, receipts and refunds."
      ]
    ]
  }
}

const evaluation = {
  "fr": {
    "title": "Évaluez AtechOS avant de déployer dans votre école",
    "intro": "Voici trois parcours à vérifier avec des comptes de test et des données fictives.",
    "items": [
      [
        "Présences et sorties",
        "Scannez un badge sur un appareil KIOS autorisé, vérifiez l’heure d’entrée et contrôlez la remise d’un enfant à un adulte autorisé."
      ],
      [
        "Paiements et reçus",
        "Enregistrez un paiement partiel, puis comparez le reçu, le solde et l’historique après un remboursement."
      ],
      [
        "Notes et bulletins",
        "Saisissez une note comme enseignant, publiez le bulletin depuis un compte habilité et vérifiez que le parent voit seulement le dossier de son enfant."
      ]
    ],
    "closing": "Avant de saisir des données réelles, demandez les conditions définitives, les modalités d’assistance et les options de récupération des données."
  },
  "ht": {
    "title": "Evalye AtechOS anvan w mete l nan lekòl ou",
    "intro": "Men twa travay pou verifye ak kont tès ak done fiktif.",
    "items": [
      [
        "Prezans ak sòti",
        "Eskane yon badj sou yon aparèy KIOS otorize, verifye lè antre a epi tcheke si se yon granmoun otorize ki vin chèche timoun nan."
      ],
      [
        "Peman ak resi",
        "Anrejistre yon peman pasyèl, epi konpare resi a, balans lan ak istorik la apre yon ranbousman."
      ],
      [
        "Nòt ak bilten",
        "Antre yon nòt kòm pwofesè, pibliye bilten an ak yon kont otorize epi verifye paran an wè dosye pitit li sèlman."
      ]
    ],
    "closing": "Anvan w mete done reyèl, mande kondisyon final yo, kijan asistans lan mache ak kijan pou w rekipere done lekòl la."
  },
  "en": {
    "title": "Evaluate AtechOS before rolling it out to your school",
    "intro": "Use test accounts and fictional data to check these three workflows.",
    "items": [
      [
        "Attendance and pickup",
        "Scan a badge on an authorized KIOS device, check the entry time and verify pickup by an authorized adult."
      ],
      [
        "Payments and receipts",
        "Record a partial payment, then compare the receipt, balance and transaction history after a refund."
      ],
      [
        "Grades and report cards",
        "Enter a grade as a teacher, publish the report card from an authorized account and check that the parent sees only their child’s record."
      ]
    ],
    "closing": "Before entering real data, ask for the final terms, support arrangements and data recovery options."
  }
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
  const locale = localeFrom((await cookies()).get('atechos_locale')?.value)
  const copy = landingCopyFor(locale)
  const guide = evaluation[locale]
  const plans = schoolPlans[locale]
  const [limit, monthly, yearly, annualTerms, invoiceTerms, trialAvailability] = pricingCopy[locale]
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
    <section id="evaluation" className="landing-section landing-subpage-content" aria-labelledby="evaluation-title">
      <div className="landing-frame">
        <h2 id="evaluation-title">{guide.title}</h2>
        <p>{guide.intro}</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {guide.items.map(([title, description]) => (
            <li key={title} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800">
              <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 leading-relaxed">{description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl">{guide.closing}</p>
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
    <section id="offres" className="landing-section landing-subpage-content" aria-labelledby="plans-title">
      <div className="landing-frame">
        <h2 id="plans-title" className="text-3xl font-semibold tracking-tight">{plans.title}</h2>
        <p className="mt-2 text-slate-700">{limit}</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {plans.plans.map(([title, description], index) => (
            <li key={title} className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800">
              <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 leading-relaxed">{description}</p>
              <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
                <div><dt>{monthly}</dt><dd className="font-semibold tabular-nums">{launchPrices[index][0]} / {launchPrices[index][1]}</dd></div>
                <div><dt>{yearly}</dt><dd className="font-semibold tabular-nums">{launchPrices[index][2]} / {launchPrices[index][3]}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-5 max-w-3xl">{annualTerms}</p>
        <p className="mt-2 max-w-3xl">{invoiceTerms}</p>
        <div className="mt-6 rounded-xl bg-blue-50 p-5 text-blue-950">
          <h3 className="text-lg font-semibold">{plans.trial}</h3>
          <p className="mt-2">{plans.note}</p>
          <p className="mt-2 font-medium">{trialAvailability}</p>
        </div>
      </div>
    </section>
    <section className="landing-closing"><div className="landing-frame landing-closing__inner" data-landing-reveal>
      <div><h2>{copy.closing.title}</h2><p>{copy.closing.description}</p></div>
      <div className="landing-actions"><Link href="/signup" className="landing-button landing-button--light">{copy.closing.primary}<ArrowRight size={18} aria-hidden="true" /></Link><Link href="/signin" className="landing-button landing-button--closing-secondary">{copy.closing.secondary}</Link></div>
    </div></section>
    <MarketingFooter copy={copy} />
  </main>
}
