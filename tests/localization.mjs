import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync('src/components/app-shell.tsx', 'utf8')
const dictionary = readFileSync('src/lib/translations-extra.ts', 'utf8')
const translations = [
  ['Unable to sign out. Please try again.', 'Impossible de se déconnecter. Veuillez réessayer.', 'Pa ka dekonekte. Eseye ankò, tanpri.'],
  ['School navigation', 'Navigation de l’école', 'Navigasyon lekòl la'],
  ['School modules', 'Modules de l’école', 'Modil lekòl la'],
  ['Search results', 'Résultats de recherche', 'Rezilta rechèch'],
  ['Close navigation', 'Fermer le menu', 'Fèmen meni an'],
  ['Open navigation', 'Ouvrir le menu', 'Ouvri meni an'],
]
for (const [key, french, haitian] of translations) {
  const entry = `${JSON.stringify(key)}:[${JSON.stringify(french)},${JSON.stringify(haitian)}]`
  assert.ok(dictionary.includes(entry), `Missing French/Haitian translation for: ${key}`)
}
assert.match(shell, /placeholder=\\{t\\('Search students, parents, teachers…'\\)\\}/)
for (const key of ['School navigation', 'School modules', 'Search results', 'Close navigation', 'Open navigation', 'Notifications']) {
  assert.ok(shell.includes(`t('${key}')`), `Shared-shell label does not follow selected locale: ${key}`)
}
console.log('PASS: shared navigation and search use translated labels in French and Haitian Creole.')
