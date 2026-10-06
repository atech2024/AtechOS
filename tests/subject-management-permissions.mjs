import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const page=readFileSync('src/app/dashboard/subjects/page.tsx','utf8')
const translations=readFileSync('src/lib/translations-extra.ts','utf8')
const policies=readFileSync('supabase/migrations/20260922211050_school_platform_foundations.sql','utf8')
const rpc=readFileSync('supabase/migrations/20260922211252_fix_student_rpcs_rls.sql','utf8')

assert.match(page,/supabase\.rpc\('school_context'\)/,'the page reads the server-authorized school role context')
assert.match(page,/context\.data\?\.owner\s*\|\|\s*context\.data\?\.roles\?\.some\(\(role: string\) => \['school_admin', 'director'\]\.includes\(role\)\)/,'only school admins, directors, and the school owner get management actions')
assert.match(page,/\{canManage && <div className="flex gap-2">/,'create and assignment actions are hidden without write permission')
assert.match(page,/\{canManage \? <select[\s\S]*?: teachers\.find\(t => t\.id === a\.teacher_id\)\?\.full_name/,'non-managers see the assigned teacher as read-only text')
assert.match(page,/\.eq\('role', 'teacher'\)\.eq\('enabled', true\)/,'inactive teachers cannot be selected for a new or changed assignment')
assert.ok(translations.includes("'You can view assigned subjects and teachers here. Only a school administrator or director can change assignments.':['"),'read-only guidance is available in French and Haitian Creole')
assert.match(policies,/create policy subjects_write on public\.subjects for all to authenticated using\(private\.has_role\(school_id,array\['school_admin','director'\]\)\) with check\(private\.has_role\(school_id,array\['school_admin','director'\]\)\)/,'subject table writes are limited to the school admin/director')
assert.match(policies,/create policy teaching_write on public\.class_subjects for all to authenticated using\(private\.has_role\(school_id,array\['school_admin','director'\]\)\) with check\(private\.has_role\(school_id,array\['school_admin','director'\]\)\)/,'class-subject assignment writes are limited to the school admin/director')
assert.match(rpc,/CREATE OR REPLACE FUNCTION public\.create_subject[\s\S]*?SECURITY INVOKER/i,'subject RPC does not bypass the table write policies')
assert.match(rpc,/CREATE OR REPLACE FUNCTION public\.assign_subject_to_class[\s\S]*?SECURITY INVOKER/i,'assignment RPC does not bypass the table write policies')

console.log('PASS subject management UI matches database write roles and only offers active teachers.')
