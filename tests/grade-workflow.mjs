import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url)
function compile(path,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n]||require(n)});return exports}
const extra=compile('src/lib/translations-extra.ts')
const translations=compile('src/lib/translations.ts',{'./translations-extra':extra})
const workflow=compile('src/lib/grade-workflow.ts')
const nav=compile('src/lib/navigation.ts')
assert.ok(nav.permittedNavigation(['censeur']).some(x=>x.href==='/dashboard/publication'))
assert.ok(nav.permittedNavigation(['secretary']).some(x=>x.href==='/dashboard/publication'))
assert.ok(!nav.permittedNavigation(['surveillant']).some(x=>x.href==='/dashboard/publication'))
assert.ok(!nav.permittedNavigation(['teacher']).some(x=>x.href==='/dashboard/publication'))
const gradePage=readFileSync('src/app/dashboard/grades/page.tsx','utf8')
assert.match(gradePage,/\['school_admin','director','censeur','secretary'\]/)
assert.match(gradePage,/period\?\.code\.match\(\/\^T\(\[1-4\]\)\$\/\)/)
assert.match(gradePage,/Automatic assessment/)
assert.match(gradePage,/default_max_score/)
assert.match(gradePage,/p_assessment_weight:100/)
const subjectsPage=readFileSync('src/app/dashboard/subjects/page.tsx','utf8')
assert.match(subjectsPage,/create_subject_with_max_score/)
assert.match(subjectsPage,/set_subject_default_max_score/)
assert.match(subjectsPage,/name="max_score"/)
assert.doesNotMatch(gradePage,/<T text="Control \/ assessment"\/><select/)
const deadlineAuthorization=readFileSync('src/components/grade-deadline-authorization.tsx','utf8')
assert.match(deadlineAuthorization,/grant_grade_deadline_exception/)
assert.match(deadlineAuthorization,/type="datetime-local"/)
assert.match(deadlineAuthorization,/\['school_admin','director','censeur'\]/)
assert.match(deadlineAuthorization,/p_class: classId, p_subject: subjectId, p_period: periodId/)
const gradeDeadlineMigration=readFileSync('supabase/migrations/20261008231500_period_grade_entry_and_deadline_exceptions.sql','utf8')
assert.match(gradeDeadlineMigration,/grade_deadline_exceptions/)
assert.match(gradeDeadlineMigration,/expires_at>now\(\)/)
assert.match(gradeDeadlineMigration,/private\.grade_deadline_exception_active/)
assert.match(gradeDeadlineMigration,/subject_max_score_mismatch/)
const teacherGradeWorkflow=readFileSync('src/components/grade-workflow.tsx','utf8')
assert.match(teacherGradeWorkflow,/id="grade-submit"/)
assert.match(teacherGradeWorkflow,/const eligible=grades\.filter/)
assert.match(teacherGradeWorkflow,/const locked=grades\.filter/)
assert.ok(gradePage.indexOf('id="grade-entry"')<gradePage.indexOf('<GradeWorkflow'))
const dashboardPage=readFileSync('src/app/dashboard/page.tsx','utf8')
assert.match(dashboardPage,/GradeActions draftGrades=/)
assert.doesNotMatch(dashboardPage,/Open grade entry to verify the saved work/)
const gradeActions=readFileSync('src/components/grade-actions.tsx','utf8')
assert.match(gradeActions,/\/dashboard\/publication#grade-review/)
assert.match(gradeActions,/\/dashboard\/grades#grade-entry/)
assert.match(gradeActions,/data\.reviewer\?'.*publication#grade-review/)
const publicationPage=readFileSync('src/app/dashboard/publication/page.tsx','utf8')
assert.match(publicationPage,/id="grade-review"/)
assert.match(publicationPage,/id="grade-corrections"/)
assert.match(publicationPage,/setCorrectionsOpen\(true\)/)
const appShell=readFileSync('src/components/app-shell.tsx','utf8')
assert.match(appShell,/function notificationHref\(notice:Notice\)/)
assert.match(appShell,/withYear\(notificationHref\(notice\)\)/)
assert.match(appShell,/params\.toString\(\)\+\(hash\?'#'\+hash:''\)/)
const publicationMigration=readFileSync('supabase/migrations/20261003233104_grades_publication_secretary.sql','utf8')
assert.match(publicationMigration,/private\.has_role\(p_school,array\['school_admin','director','censeur','secretary'\]\)/)
assert.match(publicationMigration,/public\.grade_publication_review\(\)/)
assert.match(publicationMigration,/private\.grade_event\(uuid,text,text,jsonb,jsonb\)/)
assert.doesNotMatch(publicationMigration,/school_admin','director','censeur','surveillant/)
const gradeSqlVerification=readFileSync('supabase/grade-review-verification.sql','utf8')
assert.match(gradeSqlVerification,/TEST secretary publication/)
assert.match(gradeSqlVerification,/TEST surveillant publish bypass/)
assert.match(gradeSqlVerification,/activate_school_section\(yr,'primary',true\);cls:=public\.create_class/)
for(const locale of ['fr','ht']){
 const {default:Component}=compile('src/components/grade-workflow.tsx',{
  '@/lib/supabase/client':{createClient:()=>{throw Error('Rendering must not mutate data')}},
  '@/lib/grade-workflow':workflow,'@/lib/translations':translations,
  '@/components/translation-provider':{T:({text})=>translations.translate(text,locale),useLocale:()=>locale},
  '@/components/grade-history':{default:()=>null},
 })
 const html=renderToStaticMarkup(React.createElement(Component,{grades:['draft','submitted','returned','reviewed','published'].map((state,i)=>({id:String(i),student:'Fixture '+i,assessment_name:'Period',score:7,max_score:10,workflow_state:state})),onChange:async()=>{}}))
 for(const [i,state] of ['draft','submitted','returned','reviewed','published'].entries()){
  const input=html.match(new RegExp('<input[^>]*aria-label="Fixture '+i+'[^>]*>'))?.[0]
  assert.ok(input)
  assert.equal(input.includes('disabled'),['submitted','reviewed','published'].includes(state))
 }
 assert.ok(!html.includes('Save, verify, then submit.'))
 assert.ok(html.includes(translations.translate('Grade submission',locale)))
}
for(const text of Object.values(workflow.gradeStates).concat(Object.values(workflow.gradeEvents)))for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,text+' translation missing')
for(const text of ['Automatic assessment','Subject maximum score','Authorize temporary grade entry','Choose a teacher','Expires at','Reason for temporary access','Grant temporary access','Temporary grade access was granted.','The grade deadline has passed. Contact Direction to request temporary access.'])for(const locale of ['fr','ht'])assert.notEqual(translations.translate(text,locale),text,text+' translation missing')
console.log('PASS grade UI: teacher submission locks, authorized publication roles, teacher/surveillant denial, French/Creole workflow translations.')
