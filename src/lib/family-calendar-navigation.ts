export type FamilyCalendarView='month'|'week'|'day'|'year'

export function shiftFamilyCalendarAnchor(value:Date,view:FamilyCalendarView,direction:number):Date{
 const next=new Date(value)
 if(view==='year'){
  next.setUTCMonth(0,1)
  next.setUTCFullYear(next.getUTCFullYear()+direction)
  return next
 }
 if(view==='month'){
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth()+direction)
  return next
 }
 next.setUTCDate(next.getUTCDate()+direction*(view==='week'?7:1))
 return next
}
