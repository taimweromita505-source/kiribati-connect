import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {handleAlerts} from '../src/alerts.mjs';

function database(){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync('migrations').sort())sql.exec(readFileSync('migrations/'+file,'utf8'));
 return{sql,prepare(query){const statement=sql.prepare(query);let args=[];return{bind(...values){args=values;return this},async first(){return statement.get(...args)||null},async all(){return{results:statement.all(...args)}},async run(){return{meta:{changes:statement.run(...args).changes}}}}},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}};
}

test('email alerts subscribe validates email and upserts preferences', async () => {
 const db = database();
 const sent = [];
 const mockEnv = {
  DB: db,
  RESEND_API_KEY: 'test_key',
  sendMail: async (env, to, subject, text) => { sent.push({ to, subject, text }); }
 };

 // Rejects invalid email
 const reqInvalid = new Request('https://kiribaticonnect.app/api/alerts/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'not-an-email', island: 'South Tarawa' })
 });
 const resInvalid = await handleAlerts(reqInvalid, mockEnv);
 assert.equal(resInvalid.status, 400);

 // Accepts valid subscription
 const reqValid = new Request('https://kiribaticonnect.app/api/alerts/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'islander@example.ki', island: 'Abaiang', boats: true, jobs: true, digest: true })
 });
 const resValid = await handleAlerts(reqValid, mockEnv);
 assert.equal(resValid.status, 200);
 const dataValid = await resValid.json();
 assert.equal(dataValid.ok, true);

 // Stored in database
 const row = await db.prepare('SELECT * FROM email_alerts WHERE email=?').bind('islander@example.ki').first();
 assert.ok(row);
 assert.equal(row.island, 'Abaiang');
 assert.equal(row.boats, 1);
 assert.equal(row.jobs, 1);
 assert.equal(row.digest, 1);

 // Confirmation email was sent
 assert.equal(sent.length, 1);
 assert.equal(sent[0].to, 'islander@example.ki');
 assert.match(sent[0].subject, /Kiribati Connect Alerts Confirmed/);

 // Unsubscribe
 const reqUnsub = new Request('https://kiribaticonnect.app/api/alerts/unsubscribe?email=islander@example.ki', {
  method: 'GET'
 });
 const resUnsub = await handleAlerts(reqUnsub, mockEnv);
 assert.equal(resUnsub.status, 200);

 const deleted = await db.prepare('SELECT * FROM email_alerts WHERE email=?').bind('islander@example.ki').first();
 assert.equal(deleted, null);
});
