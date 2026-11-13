import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../src/worker.mjs';
function database(){const sql=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').sort())sql.exec(readFileSync('migrations/'+file,'utf8'));return {sql,prepare(query){let args=[];const s=sql.prepare(query);return {bind(...values){args=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this},async all(){return {results:s.all(...args)}},async first(){return s.get(...args)||null},async run(){return {meta:{changes:s.run(...args).changes}}}}},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}}}
const origin='https://test.example';
const request=(path,method='GET',body,cookie='',extra={})=>new Request(origin+path,{method,headers:{origin,'content-type':'application/json',cookie,...extra},...(body?{body:JSON.stringify(body)}:{})});
const token=r=>r.headers.get('set-cookie')?.split(';')[0];
async function register(env,email){const res=await worker.fetch(request('/api/auth/register','POST',{name:email,email,password:'a-long-test-password',termsAccepted:true}),env);assert.equal(res.status,201);return {cookie:token(res),id:env.DB.sql.prepare('SELECT id FROM users WHERE email=?').get(email).id}}
test('password reset emails a single-use 15 minute link, never reveals accounts, and revokes old sessions',async()=>{
 const sent=[],env={DB:database(),AUTH_PEPPER:'pepper',RESEND_API_KEY:'fixture',sendMail:async(e,to,subject,text)=>{sent.push({to,text})}};
 const member=await register(env,'reset@example.test');
 const unknown=await worker.fetch(request('/api/auth/forgot-password','POST',{email:'nobody@example.test'}),env);
 const known=await worker.fetch(request('/api/auth/forgot-password','POST',{email:'reset@example.test'}),env);
 assert.equal(unknown.status,200);assert.equal(known.status,200);assert.deepEqual(await unknown.json(),await known.json());
 assert.equal(sent.length,1);assert.equal(sent[0].to,'reset@example.test');
 const resetToken=sent[0].text.match(/reset=([A-Za-z0-9_-]{43})/)[1];
 assert.ok(!JSON.stringify(env.DB.sql.prepare('SELECT * FROM password_resets').all()).includes(resetToken));
 assert.equal((await worker.fetch(request('/api/auth/reset-password','POST',{token:resetToken,newPassword:'short'}),env)).status,400);
 const done=await worker.fetch(request('/api/auth/reset-password','POST',{token:resetToken,newPassword:'a-brand-new-password'}),env);
 assert.equal(done.status,200);
 assert.equal((await(await worker.fetch(request('/api/me','GET',null,member.cookie),env)).json()).signedIn,false);
 assert.equal((await worker.fetch(request('/api/auth/reset-password','POST',{token:resetToken,newPassword:'another-new-password'}),env)).status,400);
 assert.equal((await worker.fetch(request('/api/auth/login','POST',{email:'reset@example.test',password:'a-brand-new-password'}),env)).status,200);
 env.DB.sql.prepare('UPDATE password_resets SET used_at=NULL,expires_at=1').run();
 assert.equal((await worker.fetch(request('/api/auth/reset-password','POST',{token:resetToken,newPassword:'expired-new-password'}),env)).status,400);
});
test('without a mail provider reset sends nothing and recovery is reported unavailable',async()=>{
 const env={DB:database(),AUTH_PEPPER:'pepper'};await register(env,'a@example.test');
 assert.equal((await worker.fetch(request('/api/auth/forgot-password','POST',{email:'a@example.test'}),env)).status,200);
 assert.equal(env.DB.sql.prepare('SELECT COUNT(*) AS n FROM password_resets').get().n,0);
 assert.equal((await(await worker.fetch(request('/api/me'),env)).json()).recoveryReady,false);
});
async function liveListing(env,member,employer='Tarawa Ferries',category='Boats'){const id=crypto.randomUUID();await worker.fetch(request('/api/notices','POST',{submissionId:id,title:'Sailing',body:'Body',island:'Kiritimati',category:'Community'},member.cookie),env);env.DB.sql.prepare("UPDATE notices SET payment_state='legacy',status='approved',employer=?,category=? WHERE id=?").run(employer,category,id);return id}
test('ratings need accounts, block self-rating, upsert one vote per member and feed operator averages',async()=>{
 const env={DB:database(),AUTH_PEPPER:'pepper'},owner=await register(env,'o@example.test'),a=await register(env,'a@example.test'),b=await register(env,'b@example.test'),id=await liveListing(env,owner);
 const rate=(cookie,body)=>worker.fetch(request('/api/showcases/'+id+'/ratings','POST',body,cookie),env);
 assert.equal((await rate('',{stars:5})).status,401);
 assert.equal((await rate(owner.cookie,{stars:5})).status,403);
 assert.equal((await rate(a.cookie,{stars:6})).status,400);
 assert.equal((await rate(a.cookie,{stars:2})).status,201);
 assert.equal((await rate(a.cookie,{stars:4,review:'On time'})).status,201);
 assert.equal((await rate(b.cookie,{stars:5})).status,201);
 const detail=await(await worker.fetch(request('/api/showcases/'+id+'/ratings'),env)).json();
 assert.equal(detail.count,2);assert.equal(detail.avg,4.5);
 const summary=await(await worker.fetch(request('/api/ratings/summary'),env)).json();
 assert.deepEqual(summary.listings[id],{avg:4.5,count:2});
 assert.deepEqual(summary.operators['Boats:tarawa ferries'],{avg:4.5,count:2});
});
test('images go to R2 when bound, with only metadata in D1, and are served and deleted from R2',async()=>{
 const store=new Map(),env={DB:database(),AUTH_PEPPER:'pepper',IMAGES:{async put(k,v){store.set(k,new Uint8Array(v))},async get(k){return store.has(k)?{body:store.get(k)}:null},async delete(k){store.delete(k)}}};
 const owner=await register(env,'o@example.test'),id=await liveListing(env,owner,'X','Community');
 const up=await worker.fetch(new Request(origin+'/api/notices/'+id+'/images',{method:'POST',headers:{origin,cookie:owner.cookie,'content-type':'image/jpeg'},body:new Uint8Array([255,216,255,0,255,217])}),env);
 assert.equal(up.status,201);const url=(await up.json()).url;
 const row=env.DB.sql.prepare('SELECT * FROM listing_images').get();assert.ok(row.r2_key);assert.equal(row.bytes.length,0);assert.equal(store.size,1);
 const got=await worker.fetch(request(url),env);assert.equal(got.status,200);assert.equal(got.headers.get('cache-control'),'private, max-age=3600');assert.equal((await got.arrayBuffer()).byteLength,6);
 assert.equal((await worker.fetch(request(url,'DELETE',null,owner.cookie),env)).status,200);assert.equal(store.size,0);
});
