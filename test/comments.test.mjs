import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleHub} from '../src/hub.mjs';
import {handlePayments,fulfillPayment,verifiedEvent} from '../src/payments.mjs';
function database(){const sql=new DatabaseSync(':memory:');for(const name of readdirSync('migrations').sort())sql.exec(readFileSync('migrations/'+name,'utf8'));return {sql,prepare(query){const statement=sql.prepare(query);let params=[];return {bind(...values){params=values.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value);return this},async first(){return statement.get(...params)||null},async all(){return {results:statement.all(...params)}},async run(){return {meta:{changes:statement.run(...params).changes}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}}}
const owner={userId:'member',email:'member@example.test',role:'member'},other={userId:'other',email:'other@example.test',role:'member'},admin={userId:'admin',email:'admin@example.test',role:'admin'};
const input=()=>({submissionId:crypto.randomUUID(),title:'My island service',body:'What we offer.',island:'South Tarawa',category:'Community',links:[{label:'Our site',url:'https://example.com/offer'}]});
function request(path,method='GET',body){return new Request('https://test.local/api/'+path,{method,headers:{origin:'https://test.local','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})}
function hub(db,path,method='GET',body,user=owner){return handleHub(request(path,method,body),{DB:db},user)}
async function draft(db){const data=input();assert.equal((await hub(db,'notices','POST',data)).status,201);return data}
async function rows(db){return(await(await hub(db,'notices')).json()).notices}
function payment(db,id){const attempt=crypto.randomUUID();db.sql.prepare("INSERT INTO listing_payments(id,listing_id,user_id,session_id,order_id,location_id,state,created_at) VALUES(?,?,?,'link_test','order_test','location_test','open',?)").run(attempt,id,owner.userId,new Date().toISOString());return {id:'square_payment_test',order_id:'order_test',location_id:'location_test',status:'COMPLETED',amount_money:{amount:100,currency:'AUD'},total_money:{amount:100,currency:'AUD'}}}

test('comments require accounts and live listings, expose names without account identifiers, and enforce removal ownership',async()=>{
 const db=database();for(const u of [owner,other,admin])db.sql.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(u.userId,u.email,u.userId,'unused',new Date().toISOString());
 const data=await draft(db),path='showcases/'+data.submissionId+'/comments';
 assert.equal((await hub(db,path,'POST',{body:'Private draft'},owner)).status,404);
 await fulfillPayment(db,payment(db,data.submissionId),'test');
 assert.equal((await hub(db,path,'POST',{body:'Hello'},null)).status,401);
 assert.equal((await hub(db,path,'POST',{body:'   '})).status,400);
 assert.equal((await hub(db,path,'POST',{body:'a'.repeat(1001)})).status,400);
 const post=await hub(db,path,'POST',{body:'<script>alert(1)</script> Helpful update'});assert.equal(post.status,201);const {id}=await post.json();
 let page=await(await hub(db,path,'GET',null,null)).json();assert.equal(page.comments[0].displayName,'member');assert.equal(page.comments[0].canDelete,false);assert.equal('author_id' in page.comments[0],false);assert.equal('email' in page.comments[0],false);assert.match(page.comments[0].body,/<script>/);
 assert.equal((await hub(db,path+'/'+id,'DELETE',null,other)).status,404);
 assert.equal((await hub(db,path+'/'+id,'DELETE',null,owner)).status,200);
 assert.equal((await(await hub(db,path)).json()).comments.length,0);assert.ok(db.sql.prepare('SELECT deleted_at FROM listing_comments WHERE id=?').get(id).deleted_at);
 const second=await(await hub(db,path,'POST',{body:'Another update'})).json();assert.equal((await hub(db,path+'/'+second.id,'DELETE',null,admin)).status,200);
 await hub(db,'notices/'+data.submissionId+'/archive','PUT',{version:2});assert.equal((await hub(db,path)).status,404);assert.equal((await hub(db,path,'POST',{body:'Archived'})).status,404);
});
test('comments reject cross-origin writes, bound posting rate and paginate without duplicates',async()=>{
 const db=database();db.sql.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(owner.userId,owner.email,'Member','unused',new Date().toISOString());const data=await draft(db);await fulfillPayment(db,payment(db,data.submissionId),'test');const path='showcases/'+data.submissionId+'/comments';
 assert.equal((await handleHub(new Request('https://test.local/api/'+path,{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({body:'No'})}),{DB:db},owner)).status,403);
 for(let i=0;i<5;i++)assert.equal((await hub(db,path,'POST',{body:'Message '+i})).status,201);
 assert.equal((await hub(db,path,'POST',{body:'Too fast'})).status,429);
 for(let i=0;i<55;i++)db.sql.prepare('INSERT INTO listing_comments(id,listing_id,author_id,body,created_at) VALUES(?,?,?,?,?)').run(crypto.randomUUID(),data.submissionId,owner.userId,'Older '+i,'2026-01-01T00:00:00.000Z');
 const first=await(await hub(db,path)).json(),second=await(await hub(db,path+'?before='+first.next)).json();assert.equal(first.comments.length,50);assert.equal(second.comments.length,10);assert.equal(new Set([...first.comments,...second.comments].map(c=>c.id)).size,60);assert.equal(second.next,null);
});

test('listing owners can remove viewer comments only on their own listings',async()=>{
 const db=database();for(const u of [owner,other,admin])db.sql.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').run(u.userId,u.email,u.userId,'unused',new Date().toISOString());
 const data=await draft(db);await fulfillPayment(db,payment(db,data.submissionId),'test');const path='showcases/'+data.submissionId+'/comments';const {id}=await(await hub(db,path,'POST',{body:'Viewer question'},other)).json();
 assert.equal((await(await hub(db,path,'GET',null,owner)).json()).comments[0].canDelete,true);
 assert.equal((await hub(db,path+'/'+id,'DELETE',null,owner)).status,200);
 const second=await draft(db);db.sql.prepare("UPDATE notices SET author_id=?,status='approved',payment_state='legacy' WHERE id=?").run(other.userId,second.submissionId);const otherPath='showcases/'+second.submissionId+'/comments';const posted=await(await hub(db,otherPath,'POST',{body:'Another viewer'},admin)).json();
 assert.equal((await(await hub(db,otherPath,'GET',null,owner)).json()).comments[0].canDelete,false);
 assert.equal((await hub(db,otherPath+'/'+posted.id,'DELETE',null,owner)).status,404);
});
