import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [settings, navigation, financePlans, translations, extraTranslations, featureGate, onboarding, platformBilling, dashboard, trialSettings] = await Promise.all([
  readFile(new URL('../src/app/dashboard/settings/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/dashboard/finance/plans/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/translations.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/translations-extra.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/school-subscriptions-feature.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/onboarding/create-school/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/platform/billing/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/app/dashboard/page.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/school-trial-settings.tsx', import.meta.url), 'utf8'),
])

for (const path of [
  '/dashboard/calendar',
  '/dashboard/classes',
  '/dashboard/subjects',
  '/dashboard/kiosk-settings',
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
assert.match(featureGate, /VERCEL_ENV === 'production'/)
assert.match(featureGate, /SCHOOL_SUBSCRIPTIONS_ENABLED === 'true'/)
assert.match(featureGate, /SCHOOL_TRIAL_PREVIEW === 'true'/)
assert.match(onboarding, /isSchoolSubscriptionsEnabled/)
assert.match(settings, /isSchoolSubscriptionsEnabled/)
assert.match(platformBilling, /isSchoolSubscriptionsEnabled/)
assert.match(dashboard, /school_subscription_trial/)
assert.match(dashboard, /Boolean\(context\.data\?\.owner\) && roles\.includes\('school_admin'\)/)
assert.match(dashboard, /days remaining/)
assert.match(trialSettings, /86_400_000/)
assert.match(trialSettings, /does not reset the original end date/)
for (const label of ['School organization','Teaching and results','School finances','Fees and installments']) {
  assert.ok(translations.includes(`'${label}'`) || translations.includes(`"${label}"`) || extraTranslations.includes(`'${label}'`) || extraTranslations.includes(`"${label}"`), `Missing localized label: ${label}`)
}
console.log('PASS: settings center centralizes school configuration and subscription access uses an explicit production flag.')
