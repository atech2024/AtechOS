import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const page = readFileSync(new URL('../src/app/dashboard/parents/page.tsx', import.meta.url), 'utf8')
assert.match(page, /const filterStudents = \(query: string\)/)
assert.match(page, /matchingInviteStudents\.map/)
assert.match(page, /matchingLinkStudents\.map/)
assert.match(page, /matchingParents\.map/)
assert.match(page, /type="search"/)
assert.doesNotMatch(page, /atechos_id|AtechOS ID/)
console.log('Parent picker search checks passed')
