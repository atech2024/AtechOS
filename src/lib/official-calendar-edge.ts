export type CalendarSourceResult={
 checked_at:string
 sources_checked:number
 sources_reachable:number
 documents_found:number
 latest_calendar:{url:string;source:string;label:string;school_year:string|null;kind:'school_calendar'|'exam_calendar'}|null
 candidates:{url:string;source:string;label:string;school_year:string|null;kind:'school_calendar'|'exam_calendar'}[]
 warning:string|null
}

export async function checkOfficialCalendarSources(persist=false):Promise<CalendarSourceResult>{
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL
 const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY
 if(!supabaseUrl||!publishableKey||!serviceRoleKey)throw new Error('calendar_sync_not_configured')
 const response=await fetch(new URL('/functions/v1/official-calendar-sources',supabaseUrl),{
  method:'POST',cache:'no-store',signal:AbortSignal.timeout(30000),
  headers:{'content-type':'application/json',apikey:publishableKey,authorization:`Bearer ${serviceRoleKey}`},
  body:JSON.stringify({persist}),
 })
 const result=await response.json().catch(()=>({})) as Partial<CalendarSourceResult>&{error?:string}
 if(!response.ok)throw new Error(result.error||`calendar_source_check_failed_${response.status}`)
 return result as CalendarSourceResult
}
