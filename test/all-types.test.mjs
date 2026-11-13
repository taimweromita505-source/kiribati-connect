import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleApi} from '../src/notices.mjs';
import {normalizeListing,islandOffset} from '../src/listing-types.mjs';
import {assets} from '../src/assets.generated.mjs';
function database(){const sql=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').sort())sql.exec(readFileSync('migrations/'+file,'utf8'));return{sql,prepare(query){const statement=sql.prepare(query);let args=[];return{bind(...values){args=values;return this},async first(){return statement.get(...args)||null},async all(){return{results:statement.all(...args)}},async run(){return{meta:{changes:statement.run(...args).changes}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}}}
const author={userId:'operator',email:'operator@example.test'},admin={userId:'admin',email:'admin@example.test'},other={userId:'other',email:'other@example.test'};
function call(db,path,method='GET',data,user=author){return handleApi(new Request('https://test.local/api/'+path,{method,headers:{origin:'https://test.local','content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),db,user,'admin@example.test')}
const base=category=>({submissionId:crypto.randomUUID(),category,title:'Section test listing',body:'Local test details.',island:'South Tarawa',employer:'Test publisher',contact:'test@example.test'});
const boat=()=>({...base('Boats'),island:'Kiritimati',destinationIsland:'Kanton',departureLocal:'2099-01-01T09:00',boatStatus:'scheduled',boatConfirmed:true,price:'25.50',currency:'AUD'});
const market=()=>({...base('Marketplace'),price:'12.50',currency:'AUD',condition:'used',availability:'available',photoUrl:'https://example.com/item.jpg'});
const feed=async db=>(await(await call(db,'notices','GET',null,null)).json()).notices;
test('boats preserve route, departure-zone conversion, fares, contributor confirmation and cancellation status',async()=>{
 const db=database(),input=boat();assert.equal((await call(db,'notices','POST',{...input,confirmed_at:'2000-01-01'})).status,201);
 const pending=(await(await call(db,'notices/mine')).json()).notices[0];assert.equal(pending.details.departureUtc,'2098-12-31T19:00:00.000Z');assert.equal(pending.details.utcOffset,14);assert.equal(pending.details.price,25.5);assert.notEqual(pending.confirmed_at,'2000-01-01');
 assert.equal((await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'',version:1},admin)).status,200);
 let row=(await feed(db))[0];assert.equal(row.details.destinationIsland,'Kanton');assert.match(row.detail,/UTC\+14/);assert.match(row.detail,/25.50/);
 assert.equal((await call(db,'notices/'+input.submissionId,'PUT',{...input,boatStatus:'cancelled',version:2})).status,200);assert.equal((await feed(db)).length,0);
 assert.equal((await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'',version:3},admin)).status,200);row=(await feed(db))[0];assert.equal(row.details.boatStatus,'cancelled');assert.match(row.detail,/Sailing status: cancelled/);
});
test('boats reject invalid routes, dates, confirmations and money; cancelled past sailings remain time bounded',async()=>{
 const now='2026-10-29T12:00:00.000Z';assert.equal(islandOffset('South Tarawa'),12);assert.equal(islandOffset('Kanton'),13);assert.equal(islandOffset('Kiritimati'),14);
 for(const patch of [{destinationIsland:'Kiritimati'},{destinationIsland:'Unknown'},{departureLocal:'2099-02-30T12:00'},{departureLocal:'2099-01-01T24:00'},{boatConfirmed:false},{price:'-1'},{currency:'EUR'},{boatStatus:'verified'}])assert.throws(()=>normalizeListing({...boat(),...patch},now));
 assert.throws(()=>normalizeListing({...boat(),departureLocal:'2020-01-01T09:00'},now));
 const cancelled=normalizeListing({...boat(),boatStatus:'cancelled',departureLocal:'2026-10-30T01:00'},now);assert.equal(cancelled.expires_at,'2026-10-30T11:00:00.000Z');
 assert.throws(()=>normalizeListing({...boat(),boatStatus:'cancelled',departureLocal:'2020-01-01T09:00'},now));
});
test('boats support cargo capacity, cargo status, and departed closing status',async()=>{
 const db=database();
 const input={...boat(),cargoAccepted:true,cargoStatus:'limited',cargoTypes:'Coolers and rice sacks',cargoRate:'AUD $5/sack'};
 assert.equal((await call(db,'notices','POST',input)).status,201);
 const item=(await(await call(db,'notices/mine')).json()).notices[0];
 assert.equal(item.details.cargoAccepted,true);
 assert.equal(item.details.cargoStatus,'limited');
 assert.match(item.detail,/Cargo: Limited space/);
 assert.match(item.detail,/Coolers and rice sacks/);
 assert.equal((await call(db,'notices/'+input.submissionId+'/close','PUT',{version:1})).status,200);
 const closed=(await(await call(db,'notices/mine')).json()).notices[0];
 assert.equal(closed.status,'closed');
 assert.match(closed.detail,/Sailing status: departed/);
});
test('government category is rejected and not supported',async()=>{
 const db=database();
 assert.throws(()=>normalizeListing({category:'Government',title:'Announce',body:'Details',island:'South Tarawa'},'2026-10-29T12:00:00.000Z'));
 assert.equal((await call(db,'notices','POST',{submissionId:crypto.randomUUID(),category:'Government',title:'Test',body:'Desc',island:'South Tarawa',employer:'Gov',contact:'info@gov.ki'})).status,400);
});
test('marketplace items include price, photo, condition, reservation and a recoverable sold state',async()=>{
 const db=database(),input=market();assert.equal((await call(db,'notices','POST',input)).status,201);const stored=(await(await call(db,'notices/mine')).json()).notices[0];assert.equal(stored.details.price,12.5);assert.ok(Date.parse(stored.expires_at)>Date.now()+29*86400000);
 await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'',version:1},admin);assert.equal((await feed(db))[0].details.photoUrl,input.photoUrl);
 assert.equal((await call(db,'notices/'+input.submissionId,'PUT',{...input,availability:'reserved',version:2})).status,200);await call(db,'moderation/'+input.submissionId,'PUT',{status:'approved',note:'',version:3},admin);assert.match((await feed(db))[0].detail,/reserved/);
 assert.equal((await call(db,'notices/'+input.submissionId+'/close','PUT',{version:4},other)).status,404);assert.equal((await call(db,'notices/'+input.submissionId+'/close','PUT',{version:4})).status,200);assert.equal((await feed(db)).length,0);assert.match((await(await call(db,'notices/mine')).json()).notices[0].detail,/Availability: sold/);
});
test('marketplace photos and prices are validated; the built editor includes all types and both island selectors',()=>{
 const now='2026-10-29T12:00:00.000Z';for(const patch of [{price:''},{price:'-3'},{price:'1e3'},{price:'1.234'},{condition:'unknown'},{photoUrl:'javascript:alert(1)'},{photoUrl:'http://example.com/photo'},{photoUrl:'https://127.0.0.1/photo'},{photoUrl:'https://localhost/photo'},{photoUrl:'https://[::1]/photo'}])assert.throws(()=>normalizeListing({...market(),...patch},now));
 assert.equal(JSON.parse(normalizeListing({...market(),price:'0'},now).details_json).price,0);
 const html=assets['/community.html'].body;for(const value of ['Community','Jobs','Boats','Marketplace'])assert.ok(html.includes('value="'+value+'"'));
 assert.ok(!html.includes('value="Government"'));
 const destination=html.match(/<select name="destinationIsland">([\s\S]*?)<\/select>/)[1];assert.equal((destination.match(/<option/g)||[]).length,38);
 assert.match(assets['/app.js'].body,/destinationIsland/);
 assert.match(assets['/notices.js'].body,/Save draft/);
 assert.match(assets['/notices.js'].body,/Pay AUD \$1 & publish/);
 assert.doesNotMatch(assets['/notices.js'].body,/Approve listing/);
});
