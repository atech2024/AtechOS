import {createClient} from 'npm:@supabase/supabase-js@2.116.0'
Deno.serve(async(req:Request)=>{
 const headers={'Content-Type':'application/json','Cache-Control':'private, no-store'}
 const fail=(status:number)=>new Response(JSON.stringify({error:'Access denied'}),{status,headers})
 if(req.method!=='POST')return fail(405)
 try{
  if(Number(req.headers.get('content-length')||0)>2048)return fail(413)
  const {token}=await req.json();if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return fail(401)
  const url=Deno.env.get('SUPABASE_URL')!
  const {data,error}=await createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false}}).rpc('student_portal_overview',{p_token:token})
  if(error||!data?.student?.photo_path)return fail(403)
  const result=await createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}).storage.from('student-photos').createSignedUrl(data.student.photo_path,60)
  if(result.error||!result.data)return fail(404)
  return new Response(JSON.stringify({url:result.data.signedUrl}),{headers})
 }catch{return fail(400)}
})
