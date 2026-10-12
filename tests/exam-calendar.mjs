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
const dates=compile('src/lib/school-date.ts')
assert.deepEqual(JSON.parse(JSON.stringify(dates.previousSchoolWeek('2026-10-12'))),{start_date:'2026-10-05',end_date:'2026-10-09'})
assert.deepEqual(JSON.parse(JSON.stringify(dates.previousSchoolWeek('2026-10-19'))),{start_date:'2026-10-12',end_date:'2026-10-16'})
assert.deepEqual(JSON.parse(JSON.stringify(dates.previousSchoolWeek('2027-01-04'))),{start_date:'2026-12-28',end_date:'2027-01-01'})
const nav=compile('src/lib/navigation.ts')
for(const role of ['censeur','director','school_admin','teacher','surveillant','secretary'])assert.ok(nav.permittedNavigation([role]).some(x=>x.href==='/dashboard/calendar'))
const data={can_manage:false,can_publish:false,exams:[{id:'fixture',class_id:'class',class:'Class A',year_id:'year',year:'2026',section:'fundamental',subject_id:'subject',subject:'Math',period_id:'period',period:'Period 1',starts_at:'2026-09-25T12:00:00Z',ends_at:'2026-09-25T14:00:00Z',cancelled:false,scanned_at:'2026-09-25T11:30:00Z',version:2,published_at:'2026-09-20T12:00:00Z',revision_start:'2026-09-14',revision_end:'2026-09-18'}],periods:[],classes:[],subjects:[],closures:[]}
for(const locale of ['ht','fr']){
 const {CalendarView}=compile('src/components/exam-calendar.tsx',{'@/lib/supabase/client':{createClient:()=>{throw Error('Rendering must not query')}},'@/lib/school-date':dates,'@/components/school-date-input':{default:()=>null},'@/components/translation-provider':{T:({text})=>translations.translate(text,locale),useLocale:()=>locale},'@/components/academic-year-context':{useAcademicYear:()=>({years:[],year:null,yearId:'',canSelect:false,setYearId:()=>{}})},'@/lib/translations':translations})
 const html=renderToStaticMarkup(React.createElement(CalendarView,{data,onEdit:()=>{}}))
 assert.ok(html.includes('Math'));assert.ok(html.includes('Class A'));assert.ok(html.includes(locale==='fr'?'25 septembre 2026':'25 Septanm 2026'));assert.ok(html.includes('08:00 AM'));assert.ok(html.includes(translations.translate('Kiosk arrival',locale)));assert.ok(html.includes(translations.translate('Revision week',locale)));assert.ok(!html.includes(translations.translate('Propose a schedule change',locale)))
 const staff=renderToStaticMarkup(React.createElement(CalendarView,{data:{...data,can_manage:true},onEdit:()=>{}}));assert.ok(staff.includes(translations.translate('Propose a schedule change',locale)))
}
const secondExam={...data.exams[0],id:'fixture-other-year',year_id:'year-2',year:'2027',class:'Class B'}
const {CalendarView,calendarWithConfirmedDates,officialExamDatesForSelection}=compile('src/components/exam-calendar.tsx',{'@/lib/supabase/client':{createClient:()=>{throw Error('Rendering must not query')}},'@/lib/school-date':dates,'@/components/school-date-input':{default:()=>null},'@/components/translation-provider':{T:({text})=>text,useLocale:()=> 'fr'},'@/components/academic-year-context':{useAcademicYear:()=>({years:[],year:null,yearId:'',canSelect:false,setYearId:()=>{}})},'@/lib/translations':translations})
const selectedYearHtml=renderToStaticMarkup(React.createElement(CalendarView,{data:{...data,exams:[...data.exams,secondExam]},academicYearId:'year'}))
assert.ok(selectedYearHtml.includes('Class A'));assert.ok(!selectedYearHtml.includes('Class B'),'The shared academic year must scope the published exam list.')
const confirmedDate={id:'confirmed',year_id:'year',year:'2026',section:'fundamental',source_url:'https://calendar-ci.invalid/fixture',source_name:'MENFP',source_label:'Synthetic source',source_wording:'Synthetic exam window',category:'official_exam',start_date:'2026-11-09',end_date:'2026-11-13',confirmed_at:'2026-10-03T12:00:00Z'}
const officialHtml=renderToStaticMarkup(React.createElement(CalendarView,{data:{...data,official_exam_dates:[confirmedDate,{...confirmedDate,id:'other',year_id:'year-2',source_wording:'Other year window'}]},academicYearId:'year'}))
assert.ok(officialHtml.includes('Synthetic exam window')&&officialHtml.includes('https://calendar-ci.invalid/fixture'),'confirmed dates retain visible source attribution')
const managerCalendar=calendarWithConfirmedDates({...data,can_manage:true,official_exam_dates:[]},{...data,official_exam_dates:[confirmedDate]})
assert.ok(renderToStaticMarkup(React.createElement(CalendarView,{data:managerCalendar,academicYearId:'year'})).includes('Synthetic exam window'),'manager calendar retains confirmed dates when its editable workspace lacks the publication feed')
assert.ok(!officialHtml.includes('Other year window'),'official exam dates follow the selected academic year')
const teacherCalendar={...data,exams:[data.exams[0],{...data.exams[0],id:'secondary-exam',class_id:'secondary-class',class:'Class B',section:'secondary'}],official_exam_dates:[confirmedDate,{...confirmedDate,id:'secondary-date',section:'secondary',source_wording:'Secondary window'},{...confirmedDate,id:'other-year-date',year_id:'year-2',source_wording:'Other year window'}]}
assert.deepEqual(officialExamDatesForSelection(teacherCalendar,'year','class').map(date=>date.id),['confirmed'],'teacher class filter uses the published exam section when manager classes are absent')
assert.deepEqual(officialExamDatesForSelection(teacherCalendar,'year','secondary-class').map(date=>date.id),['secondary-date'],'teacher class filter switches section within the same academic year')
assert.deepEqual(officialExamDatesForSelection(teacherCalendar,'year','unknown-class').map(date=>date.id),[],'a stale class selection does not expose unrelated official dates')
assert.deepEqual(officialExamDatesForSelection({...teacherCalendar,exams:data.exams,official_exam_dates:[confirmedDate]},'year','class').map(date=>date.id),['confirmed'],'family calendars work with the already scoped published exam and date rows')
assert.ok(!selectedYearHtml.includes('Synthetic exam window'),'unconfirmed source proposals do not appear in the family calendar')
const publication=readFileSync('src/app/dashboard/publication/page.tsx','utf8')
assert.ok(publication.includes('const yearRows=rows.filter(r=>!academicYearId||r.year_id===academicYearId)'),'Publication review must limit batch actions to the selected academic year.')
assert.ok(publication.includes("select('id,start_date,end_date,academic_year_id')")&&publication.includes('yearPeriods=periods.filter(p=>!academicYearId||p.year_id===academicYearId)'),'grade deadlines are tied to the selected year by period ID')
assert.ok(publication.includes("!periods.some(p=>p.id===period&&(!academicYearId||p.year_id===academicYearId))")&&publication.includes("yearDeadlines=deadlines.filter(d=>yearPeriodIds.has(d.period_id))"),'deadline form resets stale year selections and only lists current-year deadlines')
assert.ok(publication.includes('setFilters(academicYearId?{year_id:academicYearId}:{})')&&publication.includes('setReview(null)},[academicYearId])'),'changing years clears stale review filters and pending bulk selections')
assert.ok(publication.includes('new Map(yearRows.filter(r=>r[key]!==null)')&&publication.includes('No grades match the selected filters.'),'grade filters and empty state reflect only the selected academic year')
const bulletinPublication=readFileSync('src/components/bulletin-publication.tsx','utf8')
assert.ok(bulletinPublication.includes("year_id===academicYearId")&&bulletinPublication.includes('classes.map(c=>'),'bulletin publishing and archived versions use the selected academic year class set')
const gradingPeriods=readFileSync('src/app/dashboard/grading-periods/page.tsx','utf8')
assert.ok(gradingPeriods.includes('activate_grading_period_by_section_dates')&&gradingPeriods.includes('p_section_dates:dates'),'section-specific dates use the validated database RPC')
assert.ok(gradingPeriods.includes('previousSchoolWeek')&&gradingPeriods.includes('Automatic revision week'),'revision week is previewed automatically')
console.log('PASS calendar UI: official version, Haiti date/time, revision week, kiosk arrival and no family edit controls; scoped staff menu.')
