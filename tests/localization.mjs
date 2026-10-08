import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require=createRequire(import.meta.url)
const i18nExports={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/i18n.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:i18nExports,require})
assert.equal(i18nExports.localeFrom(undefined),'fr','French is the default product language.')
assert.equal(i18nExports.localeFrom('ht'),'ht','The explicit Haitian Creole preference must be retained.')
assert.equal(i18nExports.localeFrom('en'),'en','The explicit English preference must be retained.')

const shell = readFileSync('src/components/app-shell.tsx', 'utf8')
const grades = readFileSync('src/app/dashboard/grades/page.tsx', 'utf8')
const periods = readFileSync('src/app/dashboard/grading-periods/page.tsx', 'utf8')
const guard = readFileSync('src/app/dashboard/guard/page.tsx', 'utf8')
const dictionary = readFileSync('src/lib/translations.ts', 'utf8') + '\n' + readFileSync('src/lib/translations-extra.ts', 'utf8')
const translationKeys = new Set([...dictionary.matchAll(/(?:'([^'\\]+)'|"([^"\\]+)")\s*:/g)].map(match => match[1] || match[2]))

for (const [name, source] of [['shared shell', shell], ['grade entry', grades], ['grading periods', periods], ['GUARD', guard]]) {
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
assert.ok(periods.includes('schoolDate(dates.start_date)'))
assert.ok(periods.includes('SchoolDateInput required value={start}'))
assert.ok(periods.includes('SchoolDateInput required value={end}'))
assert.ok(periods.includes('schoolDate(revision.start_date)'))
assert.ok(guard.includes('schoolDate(c.event_date)'))
assert.ok(guard.includes('schoolDateTime(value)'))
assert.ok(!guard.includes("new Intl.DateTimeFormat('fr-HT'"))
console.log('PASS: shared navigation, grade entry, grading periods, and GUARD have translations; dates use the Haiti school date format.')
