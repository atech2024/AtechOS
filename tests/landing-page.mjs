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
const iconNames = ['ArrowRight', 'BookOpenCheck', 'CalendarDays', 'CircleDollarSign', 'GraduationCap', 'MessageSquareText', 'School', 'ShieldCheck', 'UsersRound', 'UserRoundCheck', 'ClipboardList', 'Check']
const iconMock = Object.fromEntries(iconNames.map(name => [name, props => React.createElement('svg', props)]))
const linkMock = { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }
const marketingChrome = compile('src/components/marketing-chrome.tsx', { 'next/link': linkMock, 'lucide-react': iconMock })
const common = {
  'next/link': linkMock,
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'fr' }) }) },
  'lucide-react': iconMock,
  '@/lib/landing-content': { landingCopyFor },
  '@/lib/i18n': { localeFrom: value => value === 'ht' || value === 'en' ? value : 'fr' },
  '@/components/marketing-chrome': marketingChrome,
}

for (const locale of ['fr', 'ht', 'en']) {
  const copy = landingCopyFor(locale)
  assert.equal(copy.roles.length, 3, locale + ' must explain the three primary audiences')
  assert.equal(copy.modules.items.length, 6, locale + ' must cover the same module set')
  assert.ok(copy.hero.title && copy.hero.emphasis && copy.hero.description, locale + ' hero copy must be complete')
  assert.ok(copy.hero.previewContext && copy.hero.previewCaption, locale + ' product preview context must be labeled')
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

  const { default: FeaturesPage } = compile('src/app/fonctionnalites/page.tsx', common)
  const featuresHtml = renderToStaticMarkup(await FeaturesPage())
  assert.ok(featuresHtml.includes(copy.pages.featuresTitle) && featuresHtml.includes(copy.modules.items[0].title), locale + ' features page must render localized module content')
  assert.ok(featuresHtml.includes('id="features-content"') && featuresHtml.includes('href="/signup"') && featuresHtml.includes('href="/signin"'), locale + ' features page must provide skip target and preserve account routes')

  const { default: SolutionsPage } = compile('src/app/solutions/page.tsx', common)
  const solutionsHtml = renderToStaticMarkup(await SolutionsPage())
  assert.ok(solutionsHtml.includes(copy.pages.solutionsTitle) && solutionsHtml.includes(copy.roles[0].title), locale + ' solutions page must render localized role content')
  assert.ok(solutionsHtml.includes('id="solutions-content"') && solutionsHtml.includes('href="/signup"') && solutionsHtml.includes('href="/signin"'), locale + ' solutions page must provide skip target and preserve account routes')
}

console.log('PASS marketing pages: localized French, Haitian Creole and English content; functional navigation; account routes; feature and role pages.')
