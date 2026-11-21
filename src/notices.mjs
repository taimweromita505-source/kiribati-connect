import {ISLANDS,normalizeListing,publicListing,withDetails} from './listing-types.mjs';
export {ISLANDS};
const columns='id,title,body,island,category,status,created_at,reviewed_at,employer,contact,closing_date,expires_at,updated_at,version,details_json,source_verified,confirmed_at';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const active="status='approved' AND (expires_at IS NULL OR expires_at>?)";
function effective(row,now){return withDetails(row.status==='approved'&&row.expires_at&&row.expires_at<=now?{...row,status:'expired'}:row)}
const present=publicListing;
async function body(request){if(!request.headers.get('content-type')?.includes('application/json'))throw Error();const reader=request.body?.getReader();if(!reader)throw Error();let chunks=[],size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error()}chunks.push(value)}const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}return JSON.parse(new TextDecoder().decode(data))}
const validate=normalizeListing;
const contentColumns=['title','body','island','category','employer','contact','closing_date','expires_at','details_json','source_verified','confirmed_at'];
const contentValues=listing=>contentColumns.map(column=>listing[column]);
function event(db,id,user,action,version,now,token,snapshot){return db.prepare('INSERT INTO listing_events(id,listing_id,actor_id,action,version,created_at,snapshot_json) SELECT ?,?,?,?,?,?,? FROM notices WHERE id=? AND mutation_id=?').bind(crypto.randomUUID(),id,user.userId,action,version,now,JSON.stringify(snapshot),id,token)}
export async function handleApi(request,db,user,adminEmails=''){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,''),now=new Date().toISOString();
 const isAdmin=!!user&&adminEmails.split(',').map(value=>value.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase());
 if(path==='/api/me'&&request.method==='GET')return json({signedIn:!!user,isAdmin,displayName:user?.displayName||null});
 const writing=!['GET','HEAD'].includes(request.method);
 if(writing&&request.headers.get('origin')!==url.origin)return json({error:'Please submit from this site.'},403);
 if(path!=='/api/notices'&&!user)return json({error:'Sign in to continue.'},401);
 if(writing&&!user)return json({error:'Sign in to manage listings.'},401);
 if(path.startsWith('/api/moderation')&&!isAdmin)return json({error:'Admin access is required.'},403);
 if(!db)return json({error:'The listing database is unavailable. Please try again later.'},503);
 try{
  if(path==='/api/notices'&&request.method==='GET'){const result=await db.prepare(`SELECT ${columns} FROM notices WHERE ${active} ORDER BY created_at DESC,id DESC LIMIT 200`).bind(now).all();return json({notices:result.results.map(present)})}
  if(path==='/api/notices/mine'&&request.method==='GET'){const result=await db.prepare(`SELECT ${columns},review_note FROM notices WHERE author_id=? ORDER BY COALESCE(updated_at,created_at) DESC,id DESC LIMIT 100`).bind(user.userId).all();return json({notices:result.results.map(row=>effective(row,now))})}
  if(path==='/api/moderation'&&request.method==='GET'){const status=url.searchParams.get('status')||'pending';if(!['pending','approved','rejected','closed','withdrawn','expired'].includes(status))return json({error:'Invalid status.'},400);let query,params;if(status==='approved'){query=active;params=[now]}else if(status==='expired'){query="status='approved' AND expires_at IS NOT NULL AND expires_at<=?";params=[now]}else{query='status=?';params=[status]}const result=await db.prepare(`SELECT ${columns},review_note FROM notices WHERE ${query} ORDER BY created_at ASC,id ASC LIMIT 200`).bind(...params).all();return json({notices:result.results.map(row=>effective(row,now))})}
  if(path==='/api/notices'&&request.method==='POST'){
   let data,listing;try{data=await body(request);listing=validate(data,now)}catch(error){return json({error:error.message||'Send valid JSON under 8 KB.'},400)}
   if(!/^[-a-f0-9]{36}$/i.test(data.submissionId||''))return json({error:'Invalid submission ID. Refresh and try again.'},400);
   const existing=await db.prepare(`SELECT ${columns} FROM notices WHERE id=? AND author_id=?`).bind(data.submissionId,user.userId).first();if(existing)return json({notice:effective(existing,now)});
   const token=crypto.randomUUID(),insertColumns=['id',...contentColumns,'author_id','created_at','updated_at','mutation_id'];
   const values=[data.submissionId,...contentValues(listing),user.userId,now,now,token,user.userId];
   const mutation=db.prepare(`INSERT INTO notices(${insertColumns.join(',')}) SELECT ${insertColumns.map(()=>'?').join(',')} WHERE (SELECT COUNT(*) FROM notices WHERE author_id=? AND status='pending')<5 ON CONFLICT(id) DO NOTHING`).bind(...values);
   const results=await db.batch([mutation,event(db,data.submissionId,user,'submitted',1,now,token,listing)]);
   if(!results[0].meta.changes)return json({error:'You may have up to five pending listings. Wait for review before submitting more.'},429);
   return json({notice:{id:data.submissionId,status:'pending',version:1}},201);
  }
  const ownerMatch=path.match(/^\/api\/notices\/([^/]+)(?:\/(close|withdraw))?$/),reviewMatch=path.match(/^\/api\/moderation\/([^/]+)$/);
  if((ownerMatch||reviewMatch)&&request.method==='PUT'){
   const id=(ownerMatch||reviewMatch)[1];let data;try{data=await body(request)}catch{return json({error:'Send valid JSON under 8 KB.'},400)}
   const previous=await db.prepare('SELECT * FROM notices WHERE id=?').bind(id).first();if(!previous||(!isAdmin&&previous.author_id!==user.userId)||(!reviewMatch&&previous.author_id!==user.userId))return json({error:'Listing not found.'},404);
   if(!Number.isInteger(data?.version)||data.version!==previous.version)return json({error:'This listing changed. Refresh My listings or the review queue before trying again.'},409);
   const token=crypto.randomUUID(),nextVersion=previous.version+1;
   let mutation,action,snapshot;
   if(reviewMatch){
    if(!['approved','rejected','withdrawn'].includes(data.status)||typeof data.note!=='string'||data.note.length>300)return json({error:'Choose approve, reject, or withdraw and keep the note under 300 characters.'},400);
    if(data.status==='withdrawn'?previous.status!=='approved':previous.status!=='pending')return json({error:'This listing is no longer awaiting that action. Refresh the queue.'},409);
    if(data.status==='approved'&&previous.expires_at&&previous.expires_at<=now)return json({error:'The closing or expiry date has passed. Reject this listing so the author can update it.'},400);
    if(data.status==='approved'&&['Boats','Ships','Flights'].includes(previous.category)){const sailing=JSON.parse(previous.details_json||'{}');const status=sailing.flightStatus||sailing.shipStatus||sailing.boatStatus;if(status!=='cancelled'&&sailing.departureUtc<=now)return json({error:'The departure time has passed. Ask the operator to update this schedule before approval.'},400)}
    action=data.status;const verified=action==='withdrawn'?previous.source_verified:0;snapshot={...previous,status:action,review_note:data.note.trim(),source_verified:verified};
    mutation=db.prepare('UPDATE notices SET status=?,review_note=?,reviewed_by=?,reviewed_at=?,source_verified=?,updated_at=?,version=version+1,mutation_id=? WHERE id=? AND version=?').bind(action,data.note.trim(),user.userId,now,verified,now,token,id,data.version);
   }else if(ownerMatch[2]){
    action=ownerMatch[2]==='close'?'closed':'withdrawn';if(previous.status==='withdrawn'||(action==='closed'&&!['pending','approved'].includes(previous.status)))return json({error:'That action is no longer available. Refresh My listings.'},409);
    snapshot={...previous,status:action};mutation=db.prepare('UPDATE notices SET status=?,updated_at=?,version=version+1,mutation_id=? WHERE id=? AND author_id=? AND version=?').bind(action,now,token,id,user.userId,data.version);
   }else{
    let listing;try{listing=validate(data,now)}catch(error){return json({error:error.message},400)}
    action='edited';snapshot={previous,submitted:listing};
    mutation=db.prepare(`UPDATE notices SET ${contentColumns.map(column=>column+'=?').join(',')},status='pending',review_note=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=?,version=version+1,mutation_id=? WHERE id=? AND author_id=? AND version=? AND (status='pending' OR (SELECT COUNT(*) FROM notices WHERE author_id=? AND status='pending')<5)`).bind(...contentValues(listing),now,token,id,user.userId,data.version,user.userId);
   }
   const results=await db.batch([mutation,event(db,id,user,action,nextVersion,now,token,snapshot)]);if(!results[0].meta.changes)return json({error:'The listing changed or your pending queue is full. Refresh and try again.'},409);
   return json({id,status:action==='edited'?'pending':action,version:nextVersion});
  }
  return json({error:'Route not found.'},404);
 }catch(error){console.error(JSON.stringify({event:'listing_api_failed',path,message:error instanceof Error?error.message:'Unknown error'}));return json({error:'The listing board is temporarily unavailable. Please try again.'},503)}
}
