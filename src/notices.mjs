export const ISLANDS = ['South Tarawa','North Tarawa','Abaiang','Maiana','Kiritimati'];
const columns = 'id,title,body,island,status,created_at,reviewed_at';
const json = (data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function present(row){return {...row,category:'Community',source:'Community board · Approved',detail:'Approved community notice. Posted '+new Date(row.created_at).toLocaleDateString('en-GB')+'.'}}
async function body(request){if(!request.headers.get('content-type')?.includes('application/json'))throw new Error('Expected JSON');const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');let chunks=[],size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new Error('Body too large')}chunks.push(value)}const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(data))}
export async function handleApi(request,db,user,adminEmails=''){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
 const isAdmin=!!user&&adminEmails.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase());
 if(path==='/api/me'&&request.method==='GET')return json({signedIn:!!user,isAdmin,displayName:user?.displayName||null});
 const writing=!['GET','HEAD'].includes(request.method);
 if(writing&&request.headers.get('origin')!==url.origin)return json({error:'Please submit from this site.'},403);
 if(path!=='/api/notices'&&!user)return json({error:'Sign in to continue.'},401);
 if(writing&&!user)return json({error:'Sign in to submit a notice.'},401);
 if(path.startsWith('/api/moderation')&&!isAdmin)return json({error:'Admin access is required.'},403);
 if(!db)return json({error:'The notice database is unavailable. Please try again later.'},503);
 try{
  if(path==='/api/notices'&&request.method==='GET'){
   const result=await db.prepare(`SELECT ${columns} FROM notices WHERE status='approved' ORDER BY created_at DESC,id DESC LIMIT 200`).all();return json({notices:result.results.map(present)});
  }
  if(path==='/api/notices/mine'&&request.method==='GET'){
   const result=await db.prepare(`SELECT ${columns},review_note FROM notices WHERE author_id=? ORDER BY created_at DESC,id DESC LIMIT 100`).bind(user.userId).all();return json({notices:result.results});
  }
  if(path==='/api/moderation'&&request.method==='GET'){
   const status=url.searchParams.get('status')||'pending';if(!['pending','approved','rejected'].includes(status))return json({error:'Invalid status.'},400);
   const result=await db.prepare(`SELECT ${columns},review_note FROM notices WHERE status=? ORDER BY created_at ASC,id ASC LIMIT 200`).bind(status).all();return json({notices:result.results});
  }
  if(path==='/api/notices'&&request.method==='POST'){
   let data;try{data=await body(request)}catch{return json({error:'Send valid JSON under 8 KB.'},400)}
   const title=typeof data?.title==='string'?data.title.trim():'',text=typeof data?.body==='string'?data.body.trim():'';
   if(!title||title.length>100||!text||text.length>1000||!ISLANDS.includes(data?.island)||!/^[-a-f0-9]{36}$/i.test(data?.submissionId||''))return json({error:'Enter a title (1–100 characters), notice (1–1,000 characters), and a valid island.'},400);
   const existing=await db.prepare(`SELECT ${columns} FROM notices WHERE id=? AND author_id=?`).bind(data.submissionId,user.userId).first();if(existing)return json({notice:existing},200);
   const result=await db.prepare(`INSERT INTO notices (id,title,body,island,author_id,status,created_at) SELECT ?,?,?,?,?,'pending',? WHERE (SELECT COUNT(*) FROM notices WHERE author_id=? AND status='pending')<5 ON CONFLICT(id) DO NOTHING`).bind(data.submissionId,title,text,data.island,user.userId,new Date().toISOString(),user.userId).run();
   if(!result.meta.changes)return json({error:'You may have up to five pending notices. Wait for review before submitting more.'},429);
   return json({notice:{id:data.submissionId,status:'pending'}},201);
  }
  if(path.startsWith('/api/moderation/')&&request.method==='PUT'){
   const id=path.slice('/api/moderation/'.length);let data;try{data=await body(request)}catch{return json({error:'Invalid review request.'},400)}
   if(!['approved','rejected'].includes(data?.status)||typeof data?.note!=='string'||data.note.length>300)return json({error:'Choose approve or reject and keep the note under 300 characters.'},400);
   const result=await db.prepare(`UPDATE notices SET status=?,review_note=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'`).bind(data.status,data.note.trim(),user.userId,new Date().toISOString(),id).run();
   if(!result.meta.changes)return json({error:'This notice was already reviewed or no longer exists. Refresh the queue.'},409);
   return json({status:data.status});
  }
  return json({error:'Route not found.'},404);
 }catch(error){console.error(JSON.stringify({event:'notice_api_failed',path,message:error instanceof Error?error.message:'Unknown error'}));return json({error:'The notice board is temporarily unavailable. Please try again.'},503)}
}
