import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [settings, navigation, financePlans, translations, extraTranslations] = await Promise.all([
  readFile(new URL('../src/app/dashboard/settings/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/dashboard/finance/plans/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/translations.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/translations-extra.ts', import.meta.url), 'utf8'),
])

for (const path of [
  '/dashboard/calendar',
  '/dashboard/classes',
  '/dashboard/subjects',
  '/dashboard/grading-settings',
  '/dashboard/grading-periods',
  '/dashboard/finance/settings',
  '/dashboard/finance/plans',
]) assert.ok(settings.includes(path), `Settings center must link to ${path}`)

assert.match(settings, /school_context/)
assert.match(settings, /school_admin.*director/)
assert.match(financePlans, /initialTab="plans"/)
assert.ok(!navigation.includes("{label:'Finance settings'"))
assert.ok(!navigation.includes("{label:'Grading periods'"))
for (const label of ['School organization','Teaching and results','School finances','Fees and installments']) {
  assert.ok(translations.includes(`'${label}'`) || translations.includes(`"${label}"`) || extraTranslations.includes(`'${label}'`) || extraTranslations.includes(`"${label}"`), `Missing localized label: ${label}`)
}
console.log('PASS: the settings center links all identified school configuration areas, and direct configuration links are centralized.')
