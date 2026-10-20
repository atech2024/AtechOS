export type PreschoolAssignedStaff={id:string;name:string;role:string;display_label?:string}
export type PreschoolClassOverview={id:string;name:string;grade:string;year_id:string;year:string;student_count:number;staff:PreschoolAssignedStaff[]}

export const preschoolLevelDefinitions=[
 {code:'PS1',name:'Petite Section',age:'3–4 ans'},
 {code:'PS2',name:'Moyenne Section',age:'4–5 ans'},
 {code:'PS3',name:'Grande Section',age:'5–6 ans'},
] as const

export function filterPreschoolAttendanceClasses<T extends {grade_level:string|null;grade_level_id:string|null}>(classes:T[],gradeLevels:{id:string;code:string}[]):T[]{
 const codes=new Map(gradeLevels.map(level=>[level.id,level.code]))
 const preschoolCodes=new Set<string>(preschoolLevelDefinitions.map(level=>level.code))
 return classes.filter(item=>preschoolCodes.has((item.grade_level_id?codes.get(item.grade_level_id):null)||item.grade_level||''))
}

export function summarizePreschoolLevels(classes:PreschoolClassOverview[]){
 return preschoolLevelDefinitions.map(level=>{
  const matching=classes.filter(item=>item.grade.trim().toUpperCase()===level.code)
  return {
   ...level,
   classCount:matching.length,
   studentCount:matching.reduce((sum,item)=>sum+Math.max(0,item.student_count),0),
   teacherCount:new Set(matching.flatMap(item=>item.staff.filter(staff=>staff.role==='titulaire').map(staff=>staff.id))).size,
   assistantCount:new Set(matching.flatMap(item=>item.staff.filter(staff=>staff.role==='aide_educatrice').map(staff=>staff.id))).size,
   classes:matching,
  }
 })
}

export function uniquePreschoolStaff(classes:PreschoolClassOverview[]){
 const staff=new Map<string,PreschoolAssignedStaff>()
 for(const item of classes)for(const person of item.staff)staff.set(person.id,person)
 return [...staff.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'))
}

export function uniquePreschoolClassStaff(staff:PreschoolAssignedStaff[]){
 const people=new Map<string,PreschoolAssignedStaff>()
 for(const person of staff){
  const current=people.get(person.id)
  if(!current||person.role==='titulaire')people.set(person.id,person)
 }
 return [...people.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'))
}

export type PreschoolAttendanceState='present'|'absent'|'unrecorded'
export function preschoolAttendanceState(status?:string|null):PreschoolAttendanceState{
 if(status==='present'||status==='late'||status==='checkout')return 'present'
 if(status==='absent')return 'absent'
 return 'unrecorded'
}

export function summarizePreschoolAttendance<T extends {status?:string|null}>(students:T[]){
 return students.reduce((summary,student)=>{
  const state=preschoolAttendanceState(student.status)
  summary[state]++
  return summary
 },{present:0,absent:0,unrecorded:0})
}
