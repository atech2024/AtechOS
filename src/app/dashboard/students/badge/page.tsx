import {redirect} from 'next/navigation'
export default async function StudentBadge({searchParams}:{searchParams:Promise<{student?:string}>}){const {student}=await searchParams;redirect('/dashboard/badges'+(student?'?student='+encodeURIComponent(student):''))}
