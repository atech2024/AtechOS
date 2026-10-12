export type PeriodSectionDates = Record<string,{start_date:string;end_date:string;revision_start?:string;revision_end?:string}>
export type EditablePeriod = {sections:string[];start_date:string;end_date:string;section_dates?:PeriodSectionDates|null}

/** Hydrate every selected section, falling back to legacy shared dates for older rows. */
export function hydratePeriodDates(period:EditablePeriod) {
 const sections=Array.isArray(period.sections)?period.sections:[]
 const sectionDates=Object.fromEntries(sections.map(section=>{
  const saved=period.section_dates?.[section]
  return [section,{start_date:saved?.start_date||period.start_date||'',end_date:saved?.end_date||period.end_date||''}]
 })) as Record<string,{start_date:string;end_date:string}>
 const ranges=Object.values(sectionDates),first=ranges[0]||{start_date:'',end_date:''}
 const sameDates=ranges.length>0&&ranges.every(range=>range.start_date===first.start_date&&range.end_date===first.end_date)
 return {sectionDates,sameDates,start_date:first.start_date,end_date:first.end_date}
}
