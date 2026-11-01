import {reply} from './auth.mjs';
import {readJson} from './hub.mjs';
export const visibleTo=(alias='n')=>`NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.user_id=? AND b.blocked_id=${alias}.author_id) OR (b.blocked_id=? AND b.user_id=${alias}.author_id))`;
export async function blocked(db,viewer,author){if(!viewer)return false;return !!await db.prepare('SELECT 1 FROM user_blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)').bind(viewer,author,author,viewer).first()}
export async function handleSafety(request,env,user){
 const path=new URL(request.url).pathname,db=env.DB;
 if(!user)return reply({error:'Sign in to use safety controls.'},401);
 if(request.method!=='GET'&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Use this site.'},403);
 try{
  if(path==='/api/blocks'&&request.method==='GET'){const rows=await db.prepare("SELECT b.blocked_id AS id,u.name FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 200").bind(user.userId).all();return reply({blocks:rows.results})}
  if(path==='/api/blocks'&&['POST','DELETE'].includes(request.method)){
   const data=await readJson(request);if(typeof data.userId!=='string'||data.userId===user.userId)return reply({error:'Choose another member.'},400);
   const target=await db.prepare('SELECT id FROM users WHERE id=? AND deleted_at IS NULL').bind(data.userId).first();if(!target)return reply({error:'Member not found.'},404);
   if(request.method==='POST')await db.prepare('INSERT OR IGNORE INTO user_blocks(user_id,blocked_id,created_at) VALUES(?,?,?)').bind(user.userId,data.userId,new Date().toISOString()).run();
   else await db.prepare('DELETE FROM user_blocks WHERE user_id=? AND blocked_id=?').bind(user.userId,data.userId).run();return reply({ok:true});
  }
  if(path==='/api/reports'&&request.method==='POST'){
   const data=await readJson(request),kind=data.kind,reasons=['Spam or scam','Harassment or hate','Sexual or harmful content','Dangerous or misleading information','Other'];
   if(!['listing','comment','user','ai'].includes(kind)||!reasons.includes(data.reason)||typeof data.details!=='string'||data.details.length>1000)return reply({error:'Choose a report reason and use up to 1,000 characters.'},400);
   const target=typeof data.targetId==='string'?data.targetId:'';let snapshot='';
   if(kind==='listing'){const row=await db.prepare("SELECT title,body FROM notices WHERE id=? AND status='approved'").bind(target).first();if(!row)return reply({error:'Listing unavailable.'},404);snapshot=JSON.stringify(row)}
   if(kind==='comment'){const row=await db.prepare('SELECT body FROM listing_comments WHERE id=? AND deleted_at IS NULL').bind(target).first();if(!row)return reply({error:'Comment unavailable.'},404);snapshot=row.body}
   if(kind==='user'&&!await db.prepare('SELECT id FROM users WHERE id=? AND deleted_at IS NULL').bind(target).first())return reply({error:'Member unavailable.'},404);
   if(kind==='ai'){if(typeof data.response!=='string'||!data.response.trim()||data.response.length>6000)return reply({error:'Select the Kiri response to report.'},400);snapshot=data.response}
   const count=await db.prepare('SELECT COUNT(*) AS n FROM safety_reports WHERE reporter_id=? AND created_at>?').bind(user.userId,new Date(Date.now()-3600000).toISOString()).first();if(count.n>=10)return reply({error:'Report limit reached. Try again later.'},429);
   await db.prepare('INSERT INTO safety_reports(id,reporter_id,kind,target_id,reason,details,snapshot,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,kind,kind==='ai'?'kiri':target,data.reason,data.details.trim(),snapshot.slice(0,7000),new Date().toISOString()).run();return reply({received:true},201);
  }
  if(path==='/api/reports'&&request.method==='GET'&&user.role==='admin'){const rows=await db.prepare("SELECT id,kind,target_id,reason,details,snapshot,status,created_at FROM safety_reports ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,created_at DESC LIMIT 100").all();return reply({reports:rows.results})}
  const match=path.match(/^\/api\/reports\/([-a-f0-9]{36})$/i);
  if(match&&request.method==='PUT'&&user.role==='admin'){
   const data=await readJson(request),report=await db.prepare("SELECT * FROM safety_reports WHERE id=? AND status='open'").bind(match[1]).first();if(!report)return reply({error:'Report not found.'},404);
   if(!['dismiss','remove'].includes(data.action))return reply({error:'Choose an action.'},400);const now=new Date().toISOString(),changes=[];
   if(data.action==='remove'){
    if(report.kind==='listing')changes.push(db.prepare("UPDATE notices SET status='removed',updated_at=?,version=version+1 WHERE id=?").bind(now,report.target_id));
    else if(report.kind==='comment')changes.push(db.prepare('UPDATE listing_comments SET deleted_at=?,deleted_by=? WHERE id=?').bind(now,user.userId,report.target_id));
    else return reply({error:'Review this report and dismiss when handled. Member reports do not automatically suspend accounts.'},400);
   }
   changes.push(db.prepare("UPDATE safety_reports SET status=?,resolved_at=? WHERE id=? AND status='open'").bind(data.action==='remove'?'removed':'dismissed',now,match[1]));await db.batch(changes);return reply({ok:true});
  }
  return reply({error:'Route not found.'},404);
 }catch{return reply({error:'Could not complete this safety request.'},400)}
}
