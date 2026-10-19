export type PreschoolAssignedStaff={id:string;name:string;role:string}
export type PreschoolClassOverview={id:string;name:string;grade:string;year_id:string;year:string;student_count:number;staff:PreschoolAssignedStaff[]}

export const preschoolLevelDefinitions=[
 {code:'PS1',name:'Petite Section',age:'3–4 ans'},
 {code:'PS2',name:'Moyenne Section',age:'4–5 ans'},
 {code:'PS3',name:'Grande Section',age:'5–6 ans'},
] as const

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
