const encode=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=text=>Uint8Array.from(atob(text),char=>char.charCodeAt(0));
export const reply=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
export async function digest(text){return b64(await crypto.subtle.digest('SHA-256',encode.encode(text)))}
export async function makeHash(password,pepper,salt=b64(crypto.getRandomValues(new Uint8Array(16)))){
 const secret=await crypto.subtle.importKey('raw',encode.encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const material=await crypto.subtle.sign('HMAC',secret,encode.encode(password));
 const key=await crypto.subtle.importKey('raw',material,'PBKDF2',false,['deriveBits']);
 const result=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:100000,hash:'SHA-256'},key,256);
 return 'v1:'+salt+':'+b64(result);
}
async function matches(password,hash,pepper){try{const derived=await makeHash(password,pepper,hash.split(':')[1]);const a=encode.encode(derived),b=encode.encode(hash);if(a.length!==b.length)return false;return crypto.subtle.timingSafeEqual?crypto.subtle.timingSafeEqual(a,b):a.reduce((value,byte,index)=>value|(byte^b[index]),0)===0}catch{return false}}
export async function getUser(request,db){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-kc-session=([a-zA-Z0-9_-]{43})/)?.[1];if(!token)return null;return db.prepare('SELECT u.id AS userId,u.email,u.name AS displayName,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.deleted_at IS NULL').bind(await digest(token),Date.now()).first()}
const cookie=(token,maxAge=604800)=>`__Host-kc-session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
async function session(db,user){const token=b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),user.userId||user.id,Date.now()+604800000).run();return cookie(token)}
async function limit(db,key,max){const now=Date.now();const row=await db.prepare('INSERT INTO auth_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+900000,now,now).first();return row.attempts<=max}
async function read(request){const reader=request.body?.getReader();if(!reader)throw Error();let parts=[],size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error()}parts.push(value)}let bytes=new Uint8Array(size),offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder().decode(bytes))}
export async function handleAuth(request,env,user){
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 const url=new URL(request.url);if(request.headers.get('origin')!==url.origin)return reply({error:'Please use this site to sign in.'},403);
 const path=url.pathname,db=env.DB;
 if(path==='/api/auth/logout'){
  const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-kc-session=([a-zA-Z0-9_-]{43})/)?.[1];if(token)await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();return reply({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(!['/api/auth/login','/api/auth/register','/api/auth/password','/api/auth/delete-account'].includes(path))return reply({error:'Not found.'},404);
 const ip=await digest(request.headers.get('CF-Connecting-IP')||'local');if(!await limit(db,'ip:'+ip,30))return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
 let data;try{data=await read(request)}catch{return reply({error:'Invalid sign-in request.'},400)}
 if(path==='/api/auth/delete-account'){
  if(!user)return reply({error:'Sign in first.'},401);
  if(data?.confirmation!=='DELETE'||typeof data.password!=='string'||!await limit(db,'delete:'+user.userId,5))return reply({error:'Enter your current password and DELETE to confirm.'},400);
  const current=await db.prepare('SELECT password_hash FROM users WHERE id=? AND deleted_at IS NULL').bind(user.userId).first();if(!current||!await matches(data.password,current.password_hash,env.AUTH_PEPPER))return reply({error:'Current password is incorrect.'},401);
  const now=new Date().toISOString();await db.batch([
   db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.userId),
   db.prepare('DELETE FROM listing_images WHERE author_id=? OR listing_id IN (SELECT id FROM notices WHERE author_id=?)').bind(user.userId,user.userId),
   db.prepare('DELETE FROM listing_events WHERE actor_id=? OR listing_id IN (SELECT id FROM notices WHERE author_id=?)').bind(user.userId,user.userId),
   db.prepare("UPDATE listing_comments SET body='[Deleted]',deleted_at=?,deleted_by=NULL WHERE author_id=? OR listing_id IN (SELECT id FROM notices WHERE author_id=?)").bind(now,user.userId,user.userId),
   db.prepare("UPDATE notices SET title='[Deleted]',body='[Deleted]',employer=NULL,contact=NULL,details_json='{}',status='deleted',deleted_at=?,updated_at=?,version=version+1 WHERE author_id=?").bind(now,now,user.userId),
   db.prepare('DELETE FROM user_blocks WHERE user_id=? OR blocked_id=?').bind(user.userId,user.userId),
   db.prepare("UPDATE safety_reports SET reporter_id=NULL,details='',snapshot='' WHERE reporter_id=?").bind(user.userId),
   db.prepare("UPDATE kiri_memberships SET state='inactive',paid_until=?,updated_at=? WHERE user_id=?").bind(now,now,user.userId),
   db.prepare("UPDATE users SET email=?,name='Deleted member',password_hash='',role='member',deleted_at=? WHERE id=?").bind('deleted-'+crypto.randomUUID()+'@invalid.local',now,user.userId)
  ]);return reply({ok:true},200,{'Set-Cookie':cookie('',0)});
 }
 if(path==='/api/auth/password'){
  if(!user)return reply({error:'Sign in first.'},401);
  if(typeof data.password!=='string'||typeof data.newPassword!=='string'||data.newPassword.length<12||data.newPassword.length>128)return reply({error:'Use a new password between 12 and 128 characters.'},400);
  if(!await limit(db,'password:'+user.userId,8))return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
  const current=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(user.userId).first();if(!await matches(data.password,current.password_hash,env.AUTH_PEPPER))return reply({error:'Current password is incorrect.'},401);
  const hash=await makeHash(data.newPassword,env.AUTH_PEPPER);await db.batch([db.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(hash,user.userId),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.userId)]);
  return reply({ok:true},200,{'Set-Cookie':await session(db,user)});
 }
 const email=typeof data?.email==='string'?data.email.trim().toLowerCase():'';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof data.password!=='string'||data.password.length<12||data.password.length>128)return reply({error:'Enter a valid email and a password between 12 and 128 characters.'},400);
 if(!await limit(db,'email:'+await digest(email),8))return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
 let record=await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
 if(path==='/api/auth/register'){
  if(data.termsAccepted!==true&&data.termsAccepted!=='on')return reply({error:'Confirm you are 16 or older and accept the community terms and privacy policy.'},400);
  const name=typeof data.name==='string'?data.name.trim():'';if(!name||name.length>60)return reply({error:'Enter your name (up to 60 characters).'},400);
  if(record)return reply({error:'That account cannot be created. Try signing in.'},409);
  const id=crypto.randomUUID(),hash=await makeHash(data.password,env.AUTH_PEPPER);
  const inserted=await db.prepare("INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,'member',?) ON CONFLICT(email) DO NOTHING").bind(id,email,name,hash,new Date().toISOString()).run();
  if(!inserted.meta.changes)return reply({error:'That account cannot be created. Try signing in.'},409);
  return reply({ok:true},201,{'Set-Cookie':await session(db,{id})});
 }
 // Hash unknown accounts too, so login does not skip the expensive check.
 if(!record){await makeHash(data.password,env.AUTH_PEPPER,'AAAAAAAAAAAAAAAAAAAAAA==');return reply({error:'Email or password is incorrect.'},401)}
 if(!await matches(data.password,record.password_hash,env.AUTH_PEPPER))return reply({error:'Email or password is incorrect.'},401);
 return reply({ok:true},200,{'Set-Cookie':await session(db,record)});
}
