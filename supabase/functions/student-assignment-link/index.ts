import {createClient} from 'npm:@supabase/supabase-js@2.116.0'

// Custom session authentication: an AtechOS ID alone never grants access.
Deno.serve(async (req:Request)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'private, no-store'}
 const fail=(status:number)=>new Response(JSON.stringify({error:'Access denied'}),{status,headers})
 if(req.method!=='POST')return fail(405)
 try {
  if(Number(req.headers.get('content-length')||0)>2048)return fail(413)
  const {token,assignment_id}=await req.json()
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||typeof assignment_id!=='string'||!/^[a-f0-9-]{36}$/.test(assignment_id))return fail(401)
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!
  const {data,error}=await createClient(url,key,{auth:{persistSession:false}}).rpc('student_device_data',{p_token:token})
  const assignment=data?.assignments?.find((a:{id:string})=>a.id===assignment_id)
  if(error||!data?.student||!assignment?.attachment_url)return fail(403)
  // The path comes only from authorized database output, never request input.
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  const result=await service.storage.from('assignment-files').createSignedUrl(assignment.attachment_url,60)
  if(result.error||!result.data)return fail(404)
  return new Response(JSON.stringify({url:result.data.signedUrl}),{headers})
 }catch{return fail(400)}
})
