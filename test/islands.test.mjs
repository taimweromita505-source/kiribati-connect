import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import catalog from '../public/islands.json' with {type:'json'};
import {ISLANDS,handleApi} from '../src/notices.mjs';
import {assets} from '../src/assets.generated.mjs';
test('all 33 physical islands and the existing local areas share one catalog',()=>{
 const entries=catalog.groups.flatMap(group=>group.islands);
 assert.equal(entries.filter(island=>!island.parent).length,33);
 assert.equal(new Set(ISLANDS).size,38);
 for(const name of ['Banaba','Makin','Arorae','North Tabiteuea','South Tabiteuea','Betio','Kanton','Nikumaroro','Rawaki','Teraina','Tabuaeran','Millennium','Flint'])assert.ok(ISLANDS.includes(name),name);
 for(const old of ['South Tarawa','North Tarawa','Abaiang','Maiana','Kiritimati'])assert.ok(ISLANDS.includes(old));
 const html=assets['/community.html'].body;
 const filter=html.match(/<select id="island">([\s\S]*?)<\/select>/)[1],form=html.match(/<select name="island">([\s\S]*?)<\/select>/)[1];
 assert.equal((filter.match(/<option/g)||[]).length,39);
 assert.equal((form.match(/<option/g)||[]).length,38);
 assert.equal((filter.match(/<optgroup/g)||[]).length,3);
 assert.match(filter,/value="Tarawa" data-members="North Tarawa\|South Tarawa\|Betio"/);
 assert.match(filter,/value="Tabiteuea" data-members="North Tabiteuea\|South Tabiteuea"/);
 assert.match(form,/value="South Tarawa" selected/);
 for(const name of ISLANDS){assert.ok(filter.includes('value="'+name+'"'),name);assert.ok(form.includes('value="'+name+'"'),name)}
});
test('the submission API accepts every listed island and still rejects unknown locations',async()=>{
 const sql=new DatabaseSync(':memory:');for(const file of readdirSync('migrations').sort())sql.exec(readFileSync('migrations/'+file,'utf8'));
 const db={prepare(query){const statement=sql.prepare(query);let args=[];return{bind(...values){args=values;return this},async first(){return statement.get(...args)||null},async run(){return{meta:{changes:statement.run(...args).changes}}}}}};
 for(const [index,island] of ISLANDS.entries()){
  const user={userId:'island-tester-'+index,email:'tester@example.test'},request=new Request('https://test.local/api/notices',{method:'POST',headers:{origin:'https://test.local','content-type':'application/json'},body:JSON.stringify({submissionId:crypto.randomUUID(),title:'Island notice',body:'A test notice.',island})});
  assert.equal((await handleApi(request,db,user)).status,201,island);
 }
 const bad=new Request('https://test.local/api/notices',{method:'POST',headers:{origin:'https://test.local','content-type':'application/json'},body:JSON.stringify({submissionId:crypto.randomUUID(),title:'Unknown island',body:'Invalid island test.',island:'Palmyra'})});
 assert.equal((await handleApi(bad,db,{userId:'unknown',email:'tester@example.test'})).status,400);
});
