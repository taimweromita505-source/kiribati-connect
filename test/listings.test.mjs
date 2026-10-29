import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleApi} from '../src/notices.mjs';
function database(){const sql=new DatabaseSync(':memory:');for(const name of readdirSync('migrations').sort())sql.exec(readFileSync('migrations/'+name,'utf8'));return {sql,prepare(query){const statement=sql.prepare(query);let params=[];return {bind(...values){params=values;return this},async first(){return statement.get(...params)||null},async all(){return {results:statement.all(...params)}},async run(){return {meta:{changes:statement.run(...params).changes}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}}}
const author={userId:'author',email:'author@example.test'},other={userId:'other',email:'other@example.test'},admin={userId:'admin',email:'admin@example.test'};
function call(db,path,method='GET',data,user=author){return handleApi(new Request('https://test.local/api/'+path,{method,headers:{origin:'https://test.local','content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),db,user,'admin@example.test')}
const job=(island='South Tarawa')=>({submissionId:crypto.randomUUID(),title:'Island project assistant',body:'Help coordinate community activities.',island,category:'Jobs',employer:'Test organisation',contact:'jobs@example.test',closingDate:'2099-01-01'});
const publicRows=async db=>(await(await call(db,'notices','GET',null,null)).json()).notices;
test('job edits require ownership and fresh review; stale approval cannot publish changed content',async()=>{
 const db=database(),input=job();assert.equal((await call(db,'notices','POST',input)).status,201);
 assert.equal((await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'Checked',version:1},admin)).status,200);
 let rows=await publicRows(db);assert.equal(rows[0].category,'Jobs');assert.equal(rows[0].employer,input.employer);assert.match(rows[0].detail,/jobs@example.test/);
 assert.equal((await call(db,'notices/'+input.submissionId,'PUT',{...input,version:2,title:'Stolen edit'},other)).status,404);
 assert.equal((await call(db,'notices/'+input.submissionId+'/withdraw','PUT',{version:2},other)).status,404);
 assert.equal((await call(db,'notices/'+input.submissionId,'PUT',{...input,title:'Updated role',version:2})).status,200);assert.equal((await publicRows(db)).length,0);
 assert.equal((await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'Stale',version:2},admin)).status,409);
 const pending=(await(await call(db,'moderation','GET',null,admin)).json()).notices[0];assert.equal(pending.title,'Updated role');assert.equal(pending.version,3);assert.equal(pending.review_note,null);
 assert.equal((await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'Updated details checked',version:3},admin)).status,200);
 assert.equal((await call(db,'notices/'+input.submissionId+'/close','PUT',{version:4})).status,200);assert.equal((await publicRows(db)).length,0);
 assert.equal((await(await call(db,'notices/mine')).json()).notices[0].status,'closed');
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM listing_events').get().count,5);
 const event=db.sql.prepare("SELECT snapshot_json FROM listing_events WHERE action='edited'").get();assert.equal(JSON.parse(event.snapshot_json).previous.review_note,'Checked');
});
test('withdrawal removes publication and a rejected or withdrawn listing can be edited and resubmitted',async()=>{
 const db=database(),input={...job(),category:'Community',expiresOn:'2099-01-01'};assert.equal((await call(db,'notices','POST',input)).status,201);
 await call(db,'moderation/'+input.submissionId,'PUT',{status:'rejected',note:'Confirm organiser',version:1},admin);
 assert.equal((await call(db,'notices/'+input.submissionId,'PUT',{...input,version:2})).status,200);
 await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'',version:3},admin);
 assert.equal((await publicRows(db)).length,1);
 assert.equal((await call(db,'notices/'+input.submissionId+'/withdraw','PUT',{version:4})).status,200);assert.equal((await publicRows(db)).length,0);
 assert.equal((await call(db,'notices/'+input.submissionId,'PUT',{...input,version:5})).status,200);assert.equal((await(await call(db,'notices/mine')).json()).notices[0].status,'pending');
 assert.equal((await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'',version:6},admin)).status,200);
 assert.equal((await call(db,'moderation/'+input.submissionId,'PUT',{status:'withdrawn',note:'No longer current',version:7},admin)).status,200);assert.equal((await publicRows(db)).length,0);
});
test('expired jobs leave the public feed and are visible as expired to their author and administrator',async()=>{
 const db=database(),input=job('Kiritimati');await call(db,'notices','POST',input);await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'',version:1},admin);
 assert.equal(db.sql.prepare('SELECT expires_at FROM notices WHERE id=?').get(input.submissionId).expires_at,'2099-01-01T10:00:00.000Z');
 db.sql.prepare("UPDATE notices SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(input.submissionId);
 assert.equal((await publicRows(db)).length,0);assert.equal((await(await call(db,'notices/mine')).json()).notices[0].status,'expired');
 assert.equal((await(await call(db,'moderation?status=expired','GET',null,admin)).json()).notices[0].status,'expired');
 assert.equal((await(await call(db,'moderation?status=approved','GET',null,admin)).json()).notices.length,0);
});
test('job fields, valid future dates, categories, pending limits and review versions are enforced',async()=>{
 const db=database();for(const values of [{employer:''},{contact:''},{closingDate:''},{closingDate:'2000-01-01'},{closingDate:'2099-02-30'},{category:'Government'}])assert.equal((await call(db,'notices','POST',{...job(),...values})).status,400);
 const inputs=Array.from({length:5},()=>job());for(const input of inputs)assert.equal((await call(db,'notices','POST',input)).status,201);
 assert.equal((await call(db,'notices','POST',inputs[0])).status,200);assert.equal((await call(db,'notices','POST',job())).status,429);
 assert.equal((await call(db,'moderation/'+inputs[0].submissionId,'PUT',{status:'approved',note:''},admin)).status,409);
 db.sql.prepare("UPDATE notices SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(inputs[0].submissionId);
 assert.equal((await call(db,'moderation/'+inputs[0].submissionId,'PUT',{status:'approved',note:'',version:1},admin)).status,400);
 const tokenCount=db.sql.prepare('SELECT COUNT(*) AS count FROM listing_events').get().count;
 assert.equal((await call(db,'notices/'+inputs[1].submissionId,'PUT',{...inputs[1],version:999})).status,409);assert.equal(db.sql.prepare('SELECT COUNT(*) AS count FROM listing_events').get().count,tokenCount);
});
