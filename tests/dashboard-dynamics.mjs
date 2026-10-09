import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const compiled=ts.transpileModule(readFileSync('src/lib/dashboard-dynamics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const exports={};vm.runInNewContext(compiled,{exports,Date,Math})
const {DASHBOARD_ROLES,resolveDashboardWidgets}=exports
assert.deepEqual(Array.from(DASHBOARD_ROLES),['school_admin','director','secretary','teacher','accountant','censeur','surveillant','parent','student'])
const widget=(id,overrides={})=>({id,schoolId:'school-a',academicYearId:'year-26',dashboard:'student',requiredRoles:['student'],requiredCapabilities:['student:portal'],eventKinds:[],baseOrder:10,content:id,...overrides})
const event=(id,overrides={})=>({id,schoolId:'school-a',academicYearId:'year-26',kind:'exams',startsOn:'2026-10-09',endsOn:'2026-10-10',priority:0,audienceRoles:['student'],upcomingWindowDays:30,...overrides})
const context={schoolId:'school-a',academicYearId:'year-26',dashboard:'student',roles:['student'],capabilities:['student:portal'],today:'2026-10-09'}
const ordered=resolveDashboardWidgets([widget('overview',{eventKinds:['courses']}),widget('calendar',{eventKinds:['exams'],baseOrder:30}),widget('due-task',{dueOn:'2026-10-10',baseOrder:40}),widget('wrong-school',{schoolId:'school-b'}),widget('wrong-year',{academicYearId:'year-25'}),widget('staff-only',{requiredRoles:['director']}),widget('missing-capability',{requiredCapabilities:['finance:read']})],[event('exam'),event('course',{kind:'courses',startsOn:'2026-10-01',endsOn:'2026-10-31',priority:50,upcomingWindowDays:0}),event('wrong-tenant',{schoolId:'school-b',priority:-100}),event('wrong-year-event',{academicYearId:'year-25',priority:-200}),event('staff-event',{audienceRoles:['director'],priority:-300})],context)
assert.deepEqual(Array.from(ordered,x=>x.id),['calendar','due-task','overview'])
assert.ok(ordered[0].reasons.includes('event:exams:active'))
assert.ok(ordered[1].reasons.includes('deadline:soon'))
const upcoming=resolveDashboardWidgets([widget('upcoming',{eventKinds:['exams']})],[event('next',{startsOn:'2026-10-12',endsOn:'2026-10-12'})],context)
assert.ok(upcoming[0].reasons.includes('event:exams:upcoming'))
const inclusive=resolveDashboardWidgets([widget('holiday',{eventKinds:['holidays']})],[event('closure',{kind:'holidays',startsOn:'2026-10-09',endsOn:'2026-10-09',priority:5})],context)
assert.equal(inclusive[0].priority,5)
const expired=resolveDashboardWidgets([widget('past',{eventKinds:['exams']})],[event('old',{startsOn:'2026-09-01',endsOn:'2026-09-02'})],context)
assert.equal(expired[0].reasons.includes('event:exams:active'),false)
const noTenant=resolveDashboardWidgets([widget('no-scope',{schoolId:null})],[event('excluded',{priority:-999})],{...context,schoolId:null})
assert.deepEqual(Array.from(noTenant[0].reasons),['default_order'])
console.log('PASS dashboard scope, roles, capabilities, year, simultaneous events, upcoming windows, deadlines and date boundaries.')
