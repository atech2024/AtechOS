import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('src/app/dashboard/classes/page.tsx','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
const foundations=readFileSync('supabase/migrations/20260922211050_school_platform_foundations.sql','utf8')
const sections=readFileSync('supabase/migrations/20261002151506_enforce_enabled_school_section_for_classes.sql','utf8')

assert.match(page,/getSupabase\(\)\.rpc\('school_context'\)/,'page gets authorized roles from the server context')
assert.match(page,/\['school_admin', 'director', 'secretary'\]\.includes\(role\)/,'admin, director and secretary can manage classes and sections')
assert.match(page,/\['school_admin', 'director'\]\.includes\(role\)/,'only admin and director can manage academic years')
assert.match(page,/canManageAcademicYears && <button onClick=\{\(\) => setYearOpen\(true\)\}/,'authorized users have a reachable create academic year button')
assert.match(page,/yearOpen && canManageAcademicYears && <Modal title="Create academic year"/,'year creation modal is role-gated')
assert.match(page,/canManageStructure && <button onClick=\{\(\) => setClassOpen\(true\)\}/,'class creation is hidden from roles without permission')
assert.match(page,/canManageStructure && <button disabled=\{!yearId \|\| saving\}/,'section activation is hidden from roles without permission')
assert.match(page,/You can view classes and school sections here, but your role cannot change them\./,'read-only users get an explanation')
assert.match(foundations,/create policy config_write on public\.%I for all to authenticated using\(private\.has_role\(school_id,array\[''school_admin'',''director''\]\)\)/,'academic-year writes require admin or director role')
assert.match(foundations,/create policy classes_write on public\.classes for all to authenticated using\(private\.has_role\(school_id,array\['school_admin','director','secretary'\]\)\)/,'class writes permit admins, directors and secretaries')
assert.match(sections,/public\.activate_school_section[\s\S]*?array\['school_admin', 'director', 'secretary'\]/i,'section activation permits admins, directors and secretaries')
assert.ok(translations.includes("'+ Academic year':['"),'create academic year action is translated')
assert.ok(translations.includes("'You can view classes and school sections here, but your role cannot change them.':['"),'read-only message is translated')

console.log('PASS class and academic-year controls match database role permissions; academic-year modal is reachable.')

