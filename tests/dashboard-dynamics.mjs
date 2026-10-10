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
const compiledStudent=ts.transpileModule(readFileSync('src/lib/student-dashboard-events.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const studentExports={};vm.runInNewContext(compiledStudent,{exports:studentExports,Date,Intl,Set,Math})
const {buildStudentDashboardEvents,dateKey:studentDateKey}=studentExports
assert.equal(studentDateKey('2026-10-07T02:30:00.000Z'),'2026-10-06','timestamp events use Haiti local day at UTC boundaries')
assert.equal(studentDateKey('2026-10-07'),'2026-10-07','date-only values remain unchanged')
const studentPeriod={id:'period-current',year:'2026 / 2027',start_date:'2026-09-01',end_date:'2027-06-30',exam_start:null,exam_end:null}
const eventCalendar={school_scope_id:'school-a',exams:[],official_exam_dates:[],periods:[{id:'period-current',name:'1er trimestre',year_id:'year-26',sections:['primary'],start_date:'2026-09-01',end_date:'2026-12-20'}],closures:[]}
const publishedReport={cards:[{class_id:'class-a',year:'2026 / 2027',period_id:'period-current',document:{published_at:'2026-10-07T14:00:00Z'}}],preschool_cards:[{id:'pre-old',published_at:'2026-09-20T14:00:00Z',payload:{academic_year:'2025 / 2026',period_id:'period-current'}}]}
const bulletinEvents=buildStudentDashboardEvents({schoolId:'school-a',yearId:'year-26',today:'2026-10-09',calendar:eventCalendar,periods:[studentPeriod],report:publishedReport,year:'2026 / 2027'})
assert.equal(bulletinEvents.filter(item=>item.kind==='bulletins').length,1,'only published reports in the selected academic year become bulletin events')
assert.equal(bulletinEvents.find(item=>item.kind==='bulletins').startsOn,'2026-10-07')
assert.equal(bulletinEvents.find(item=>item.kind==='bulletins').endsOn,'2027-06-30','bulletin relevance follows the selected academic year boundary')
assert.equal(resolveDashboardWidgets([widget('bulletin-summary',{eventKinds:['bulletins']})],bulletinEvents,context)[0].priority,65,'published results raise their summary while preserving higher priority for exams and due work')
assert.equal(buildStudentDashboardEvents({schoolId:'school-a',yearId:'year-26',today:'2026-10-09',calendar:eventCalendar,periods:[studentPeriod],report:publishedReport,year:'2025 / 2026'}).some(item=>item.kind==='bulletins'),false,'published report events do not leak between academic years')
assert.deepEqual(Array.from(buildStudentDashboardEvents({schoolId:null,yearId:'year-26',today:'2026-10-09',calendar:eventCalendar,periods:[studentPeriod],report:publishedReport,year:'2026 / 2027'})),[],'events require the token-scoped school and selected year')
console.log('PASS student dashboard ranks published numeric and Preschool bulletins from actual published data, scoped to the selected year and its dates.')
