import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function compile(path, imports = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => imports[name] || require(name) })
  return exports
}

const { landingCopyFor } = compile('src/lib/landing-content.ts')
const { shouldEnableLandingMotion } = compile('src/lib/landing-media.ts')
assert.equal(shouldEnableLandingMotion(false, false, true), true, 'desktop can use supported decorative motion')
assert.equal(shouldEnableLandingMotion(true, false, true), false, 'reduced-motion preference must disable video')
assert.equal(shouldEnableLandingMotion(false, true, true), false, 'mobile must retain the still image')
assert.equal(shouldEnableLandingMotion(false, false, false), false, 'unsupported video must fall back to the image')
const imageMock = { default: ({ priority, ...props }) => React.createElement('img', { ...props, 'data-priority': priority ? 'true' : undefined }) }
const heroMedia = compile('src/components/landing-hero-media.tsx', {
  'next/image': imageMock,
  react: { useEffect: () => {}, useRef: () => ({ current: null }), useState: () => [false, () => {}] },
  '@/lib/landing-media': { shouldEnableLandingMotion },
})
const { prepareLandingReveals } = compile('src/components/landing-scroll-reveal.tsx', { react: { useEffect: () => {} } })
const iconNames = ['ArrowRight', 'BookOpenCheck', 'CalendarDays', 'CircleDollarSign', 'GraduationCap', 'MessageSquareText', 'School', 'ShieldCheck', 'UsersRound', 'UserRoundCheck', 'ClipboardList', 'Check']
const iconMock = Object.fromEntries(iconNames.map(name => [name, props => React.createElement('svg', props)]))
const linkMock = { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }
const marketingChrome = compile('src/components/marketing-chrome.tsx', { 'next/link': linkMock, 'lucide-react': iconMock, '@/components/landing-scroll-reveal': { default: () => null } })
const common = {
  'next/link': linkMock,
  'next/image': imageMock,
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'fr' }) }) },
  'lucide-react': iconMock,
  '@/lib/landing-content': { landingCopyFor },
  '@/lib/i18n': { localeFrom: value => value === 'ht' || value === 'en' ? value : 'fr' },
  '@/components/marketing-chrome': marketingChrome,
  '@/components/landing-hero-media': heroMedia,
}

const motionClasses = new Set()
for (const name of ['atechos-hero.webp', 'atechos-direction.webp', 'atechos-enseignants.webp', 'atechos-familles.webp', 'atechos-workflow.webp']) {
  const asset = readFileSync('public/landing/' + name)
  assert.equal(asset.subarray(0, 4).toString(), 'RIFF', name + ' must be a valid WebP container')
  assert.equal(asset.subarray(8, 12).toString(), 'WEBP', name + ' must use the optimized WebP format')
}
const heroMotion = readFileSync('public/landing/atechos-hero-motion.mp4')
assert.equal(heroMotion.subarray(4, 8).toString(), 'ftyp', 'hero motion must be a valid MP4 container')
const motionRoot = { classList: { add: value => motionClasses.add(value) } }
function revealTarget(top) {
  const classes = new Set()
  const properties = new Map()
  return { classes, properties, classList: { add: value => classes.add(value) }, style: { setProperty: (key, value) => properties.set(key, value) }, getBoundingClientRect: () => ({ top }) }
}
const reducedTarget = revealTarget(900)
assert.equal(prepareLandingReveals([reducedTarget], motionRoot, true, 800, () => assert.fail('reduced motion must not observe targets')), false)
assert.equal(motionClasses.has('landing-motion-ready'), false)
const visibleTarget = revealTarget(100)
const deferredTarget = revealTarget(900)
const observedTargets = []
assert.equal(prepareLandingReveals([visibleTarget, deferredTarget], motionRoot, false, 800, target => observedTargets.push(target)), true)
assert.equal(visibleTarget.classes.has('is-visible'), true)
assert.equal(deferredTarget.classes.has('is-visible'), false)
assert.deepEqual(observedTargets, [deferredTarget])
assert.equal(deferredTarget.properties.get('--landing-motion-delay'), '55ms')
assert.equal(motionClasses.has('landing-motion-ready'), true)
const motionCss = readFileSync('src/app/globals.css', 'utf8')
assert.ok(motionCss.includes('prefers-reduced-motion: reduce'), 'motion must respect reduced-motion settings')
assert.ok(motionCss.includes('[data-landing-reveal]:focus-within'), 'keyboard focus must reveal animated content')
assert.ok(motionCss.includes('@keyframes landing-title-line-in') && motionCss.includes('landing-hero__emphasis-line'), 'hero lines must use the deliberate staggered reveal')

for (const locale of ['fr', 'ht', 'en']) {
  const copy = landingCopyFor(locale)
  assert.equal(copy.roles.length, 3, locale + ' must explain the three primary audiences')
  assert.equal(copy.modules.items.length, 6, locale + ' must cover the same module set')
  assert.ok(copy.hero.title && copy.hero.emphasis && copy.hero.description, locale + ' hero copy must be complete')
  assert.ok(copy.visuals.heroAlt && copy.visuals.heroCaption && copy.visuals.workflowAlt && copy.visuals.workflowCaption && copy.visuals.roleAlts.length === 3, locale + ' conceptual artwork must be described and localized')
  assert.ok(copy.modules.items.every(item => item.title && item.description), locale + ' module copy must be complete')
  common['next/headers'] = { cookies: async () => ({ get: () => ({ value: locale }) }) }
  common['@/lib/i18n'] = { localeFrom: value => value === 'ht' || value === 'en' ? value : 'fr' }

  const { default: Home } = compile('src/app/page.tsx', common)
  const homeHtml = renderToStaticMarkup(await Home())
  assert.ok(homeHtml.includes(copy.hero.title) && homeHtml.includes(copy.hero.emphasis), locale + ' landing headline must be localized')
  assert.ok(homeHtml.includes(copy.closing.title), locale + ' landing closing copy must be localized')
  assert.ok(homeHtml.includes('href="/signup"') && homeHtml.includes('href="/signin"'), locale + ' existing account routes must remain available')
  assert.ok(homeHtml.includes('href="/fonctionnalites"') && homeHtml.includes('href="/solutions"'), locale + ' navigation must expose public subpages')
  assert.ok(homeHtml.includes('id="landing-hero"') && homeHtml.includes('id="access"'), locale + ' hero and access targets must exist')
  assert.ok(homeHtml.includes('landing-hero__title-line') && homeHtml.includes('landing-hero__emphasis-line'), locale + ' hero typography must reveal each line in sequence')
  assert.equal((homeHtml.match(/landing-header__inner/g) || []).length, 1, locale + ' homepage must render one shared header')
  assert.ok(homeHtml.includes('data-landing-reveal'), locale + ' landing page sections must support scroll reveal')
  assert.ok(homeHtml.includes('/landing/atechos-hero.webp') && homeHtml.includes('/landing/atechos-workflow.webp'), locale + ' homepage must show its supplied hero and workflow artwork')
  assert.ok(homeHtml.includes('/landing/atechos-direction.webp') && homeHtml.includes('/landing/atechos-enseignants.webp') && homeHtml.includes('/landing/atechos-familles.webp'), locale + ' homepage must illustrate each school audience')
  assert.ok(homeHtml.includes(copy.visuals.heroCaption) && homeHtml.includes(copy.visuals.workflowCaption), locale + ' conceptual artwork must not be confused with real product screens')
  assert.ok(homeHtml.includes('preload="none"') && !/<video[^>]*src=/.test(homeHtml), locale + ' hero motion must be deferred until the client opts in')

  const { default: FeaturesPage } = compile('src/app/fonctionnalites/page.tsx', common)
  const featuresHtml = renderToStaticMarkup(await FeaturesPage())
  assert.ok(featuresHtml.includes(copy.pages.featuresTitle) && featuresHtml.includes(copy.modules.items[0].title), locale + ' features page must render localized module content')
  assert.ok(featuresHtml.includes('id="features-content"') && featuresHtml.includes('href="/signup"') && featuresHtml.includes('href="/signin"'), locale + ' features page must provide skip target and preserve account routes')
  assert.equal((featuresHtml.match(/landing-header__inner/g) || []).length, 1, locale + ' features page must render one shared header')
  assert.equal((featuresHtml.match(/class="landing-role-row landing-role-row--solution"/g) || []).length, 3, locale + ' features page must explain each core audience')
  assert.ok(featuresHtml.includes('/landing/atechos-workflow.webp') && featuresHtml.includes(copy.visuals.workflowCaption), locale + ' features workflow art must be identified as conceptual')
  assert.ok(copy.modules.items.every(item => featuresHtml.includes(item.title) && featuresHtml.includes(item.description)), locale + ' features page must include every localized module')
  assert.equal((featuresHtml.match(/landing-module-list__icon/g) || []).length, 6, locale + ' feature modules must include an icon for each entry')

  const { default: SolutionsPage } = compile('src/app/solutions/page.tsx', common)
  const solutionsHtml = renderToStaticMarkup(await SolutionsPage())
  assert.ok(solutionsHtml.includes(copy.pages.solutionsTitle) && solutionsHtml.includes(copy.roles[0].title), locale + ' solutions page must render localized role content')
  assert.ok(solutionsHtml.includes('id="solutions-content"') && solutionsHtml.includes('href="/signup"') && solutionsHtml.includes('href="/signin"'), locale + ' solutions page must provide skip target and preserve account routes')
  assert.equal((solutionsHtml.match(/landing-header__inner/g) || []).length, 1, locale + ' solutions page must render one shared header')
  assert.ok(solutionsHtml.includes('/landing/atechos-direction.webp') && solutionsHtml.includes('/landing/atechos-enseignants.webp') && solutionsHtml.includes('/landing/atechos-familles.webp'), locale + ' solutions page must illustrate every audience')
}

console.log('PASS marketing pages and motion: localized content, supplied artwork, conceptual disclosures, responsive fallbacks, routes and reduced-motion behavior.')
