import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync('src/components/app-shell.tsx', 'utf8')
const grades = readFileSync('src/app/dashboard/grades/page.tsx', 'utf8')
const periods = readFileSync('src/app/dashboard/grading-periods/page.tsx', 'utf8')
const dictionary = readFileSync('src/lib/translations.ts', 'utf8') + '\n' + readFileSync('src/lib/translations-extra.ts', 'utf8')
const translationKeys = new Set([...dictionary.matchAll(/(?:'([^'\\]+)'|"([^"\\]+)")\s*:/g)].map(match => match[1] || match[2]))

for (const [name, source] of [['shared shell', shell], ['grade entry', grades], ['grading periods', periods]]) {
  for (const [, key] of source.matchAll(/<T\s+text="([^"]+)"/g)) {
    assert.ok(translationKeys.has(key), `Missing French/Haitian translation for ${name}: ${key}`)
  }
}
for (const key of ['Search students, parents, teachers…', 'School modules', 'Search results', 'Close navigation', 'Open navigation', 'Notifications']) {
  assert.ok(shell.includes(`t('${key}')`), `Shared-shell label does not follow selected locale: ${key}`)
}
assert.ok(shell.includes("placeholder={t('Search students, parents, teachers…')}"))
for (const key of ['Academic-year term count saved.', 'Period activated.', 'Historical control retained', 'Legacy period - no specific academic year.', 'Préscolaire', 'Primaire', 'Fondamentale · 3e cycle', 'Secondaire']) {
  assert.ok(translationKeys.has(key), `Missing translated dynamic grading-period label: ${key}`)
}
assert.ok(periods.includes('schoolDate(p.start_date)'))
assert.ok(periods.includes('SchoolDateInput name="start"'))
assert.ok(periods.includes('SchoolDateInput name="end"'))
console.log('PASS: shared navigation, grade entry, and period settings have translations; period dates display as text and use DD/MM/YYYY inputs.')
