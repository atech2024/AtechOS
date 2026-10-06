import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const component=readFileSync('src/components/family-children-overview.tsx','utf8')
const portal=readFileSync('src/app/dashboard/parent-portal/page.tsx','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
const packageJson=JSON.parse(readFileSync('package.json','utf8'))

assert.match(component,/family_child_attendance_history/,'attendance state must come from the linked-family attendance endpoint')
assert.match(component,/p_from:today,p_to:today/,'the portrait state must be tied to the Haiti school date')
assert.match(component,/childPortraitTone\(status/)
assert.match(component,/status==='absent'\?'grayscale opacity-70'/,'only a recorded absence should grayscale a portrait')
assert.match(component,/statuses\.includes\('absent'\)\?'absent':'unknown'/,'no attendance record must not imply absence')
assert.match(component,/storage\.from\('student-photos'\)\.createSignedUrl/,'private photos must use short-lived signed URLs')
assert.match(component,/aria-pressed=\{selectedId===child\.id\}/,'child selection is accessible')
assert.match(portal,/<FamilyChildrenOverview students=\{children\} selectedId=\{childId\} onSelect=\{setChildId\}\/>/)
for(const key of ['My children today','Today\'s recorded school attendance','Color means present; grayscale means recorded absent.','No record today']) assert.ok(translations.includes(`"${key}"`),`missing French/Kreyòl copy: ${key}`)
assert.ok(packageJson.scripts.test.includes('node tests/family-children-overview.mjs'),'npm test includes the family portrait/status contract')

console.log('PASS family children overview: linked children only, Haiti-today attendance, neutral unknown state and grayscale only for recorded absences.')
