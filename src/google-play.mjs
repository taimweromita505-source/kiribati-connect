import {wifReady,workloadAccessToken} from './play-identity.mjs';
import {reply} from './auth.mjs';
import {readJson} from './hub.mjs';
export const PLAY_PACKAGE='com.taimware.kiribaticonnect';
export const PLAY_PRODUCTS={listing:'listing_publish',monthly:'kiri_monthly',yearly:'kiri_yearly'};
export const playReady=env=>(!!env.PLAY_SERVICE_ACCOUNT_JSON||wifReady(env))&&env.PLAY_BILLING_ENABLED==='true';
const encode=new TextEncoder(),b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))),url64=bytes=>b64(bytes).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export const playHash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export const playAccount=userId=>playHash('kiribati-connect:'+userId);
async function cipherKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encode.encode('play-token:'+env.AUTH_PEPPER)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encryptToken(token,env){const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(env),encode.encode(token));return b64(iv)+'.'+b64(encrypted)}
async function decryptToken(value,env){const [a,b]=value.split('.'),decode=text=>Uint8Array.from(atob(text),x=>x.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(a)},await cipherKey(env),decode(b)))}
export async function playClient(env){
 let accessToken;if(wifReady(env))accessToken=await workloadAccessToken(env);else{
 const credentials=JSON.parse(env.PLAY_SERVICE_ACCOUNT_JSON),now=Math.floor(Date.now()/1000);
 if(!credentials.client_email||!credentials.private_key)throw Error('Play verification unavailable');
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(credentials.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const claims={iss:credentials.client_email,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600};
 const unsigned=url64(encode.encode(JSON.stringify({alg:'RS256',typ:'JWT'})))+'.'+url64(encode.encode(JSON.stringify(claims))),assertion=unsigned+'.'+url64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encode.encode(unsigned)));
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000)});if(!auth.ok){await auth.body?.cancel();throw Error('Play authorization failed')}const token=await auth.json();if(!token.access_token)throw Error('Play authorization failed');accessToken=token.access_token;}

 return async(path,method='GET')=>{const r=await fetch('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+PLAY_PACKAGE+path,{method,headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(20000)});if(!r.ok){await r.body?.cancel();throw Error('Play verification failed')}return r.status===204?{}:r.json()};
}
export async function fulfillPlay(db,proof,token,env,user,api){
 const tokenHash=await playHash(token),existing=await db.prepare('SELECT * FROM play_purchases WHERE token_hash=?').bind(tokenHash).first();
 const intent=await db.prepare('SELECT * FROM play_intents WHERE id=? AND user_id=?').bind(proof.obfuscatedExternalProfileId||'',user.userId).first();
 const line=proof.productLineItem?.[0],offer=line?.productOfferDetails;
 if(!intent||proof.obfuscatedExternalAccountId!==await playAccount(user.userId)||proof.productLineItem?.length!==1||line.productId!==intent.product_id||offer?.quantity!==1||offer?.rentOfferDetails||offer?.preorderOfferDetails||existing&&existing.user_id!==user.userId)throw Error('Purchase does not match this account');
 if(proof.testPurchaseContext&&env.PLAY_ALLOW_TEST_PURCHASES!=='true')throw Error('Test purchases are not enabled');
 if(proof.purchaseStateContext?.purchaseState==='PENDING')return {paid:false,pending:true};
 if(proof.purchaseStateContext?.purchaseState!=='PURCHASED'||offer.refundableQuantity===0){if(existing)await revokePlay(db,existing);throw Error('Purchase was cancelled or refunded')}
 if(!existing&&offer.consumptionState==='CONSUMPTION_STATE_CONSUMED')throw Error('Purchase already consumed');
 if(existing?.state==='revoked')throw Error('Purchase revoked');
 const now=new Date().toISOString(),statements=[db.prepare("INSERT OR IGNORE INTO play_purchases(token_hash,token,user_id,intent_id,kind,product_id,state,created_at,checked_at) VALUES(?,?,?,?,?,?,'paid',?,?)").bind(tokenHash,await encryptToken(token,env),user.userId,intent.id,intent.kind,intent.product_id,now,now)];
 if(intent.kind==='listing')statements.push(db.prepare("UPDATE notices SET payment_state='paid',paid_at=COALESCE(paid_at,?),status=CASE WHEN status='draft' AND (expires_at IS NULL OR expires_at>?) AND (category!='Boats' OR json_extract(details_json,'$.boatStatus')='cancelled' OR json_extract(details_json,'$.departureUtc')>?) THEN 'approved' ELSE status END,updated_at=?,version=version+1 WHERE id=? AND author_id=? AND payment_state='unpaid' AND EXISTS(SELECT 1 FROM play_purchases WHERE token_hash=? AND state='paid' AND fulfilled_at IS NULL)").bind(now,now,now,now,intent.listing_id,user.userId,tokenHash));
 else{
  const months=intent.kind==='monthly'?1:12;
  statements.push(db.prepare(`INSERT INTO kiri_memberships(user_id,state,paid_until,payment_id,confirmed_at,livemode,provider,updated_at)
   SELECT p.user_id,'active',strftime('%Y-%m-%dT%H:%M:%fZ',CASE WHEN m.paid_until>? THEN m.paid_until ELSE ? END,?,'floor'),p.token_hash,?,1,'google-play',? FROM play_purchases p LEFT JOIN kiri_memberships m ON m.user_id=p.user_id WHERE p.token_hash=? AND p.state='paid' AND p.fulfilled_at IS NULL
   ON CONFLICT(user_id) DO UPDATE SET state='active',paid_until=excluded.paid_until,payment_id=excluded.payment_id,confirmed_at=excluded.confirmed_at,livemode=1,provider='google-play',updated_at=excluded.updated_at`).bind(now,now,'+'+months+' months',now,now,tokenHash));
 }
 statements.push(db.prepare('UPDATE play_purchases SET fulfilled_at=COALESCE(fulfilled_at,?),checked_at=? WHERE token_hash=?').bind(now,now,tokenHash));await db.batch(statements);
 // Consumption acknowledges a one-time access pass only after durable fulfillment.
 if(offer.consumptionState!=='CONSUMPTION_STATE_CONSUMED')await api('/purchases/products/'+encodeURIComponent(intent.product_id)+'/tokens/'+encodeURIComponent(token)+':consume','POST');
 await db.prepare('UPDATE play_purchases SET acknowledged=1 WHERE token_hash=?').bind(tokenHash).run();return {paid:true};
}
async function revokePlay(db,row){const now=new Date().toISOString();await db.batch([db.prepare("UPDATE play_purchases SET state='revoked',checked_at=? WHERE token_hash=?").bind(now,row.token_hash),db.prepare("UPDATE kiri_memberships SET state='inactive',updated_at=? WHERE payment_id=? AND provider='google-play'").bind(now,row.token_hash),db.prepare("UPDATE notices SET status='removed',updated_at=?,version=version+1 WHERE id=(SELECT listing_id FROM play_intents WHERE id=?) AND status='approved'").bind(now,row.intent_id)])}
export async function reconcilePlay(env){
 if(!playReady(env))return;const api=await playClient(env),rows=await env.DB.prepare("SELECT * FROM play_purchases WHERE state='paid' ORDER BY checked_at LIMIT 50").all();
 for(const row of rows.results){try{const token=await decryptToken(row.token,env),proof=await api('/purchases/productsv2/tokens/'+encodeURIComponent(token));if(proof.purchaseStateContext?.purchaseState==='CANCELLED'||proof.productLineItem?.[0]?.productOfferDetails?.refundableQuantity===0)await revokePlay(env.DB,row);else{if(!row.acknowledged&&proof.purchaseStateContext?.purchaseState==='PURCHASED'){await api('/purchases/products/'+row.product_id+'/tokens/'+encodeURIComponent(token)+':consume','POST');await env.DB.prepare('UPDATE play_purchases SET acknowledged=1 WHERE token_hash=?').bind(row.token_hash).run()}await env.DB.prepare('UPDATE play_purchases SET checked_at=? WHERE token_hash=?').bind(new Date().toISOString(),row.token_hash).run()}}catch{console.error(JSON.stringify({event:'play_reconciliation_failed'}))}}
}
export async function handlePlay(request,env,user){
 if(!user)return reply({error:'Sign in to buy or restore purchases.'},401);
 const url=new URL(request.url);if(request.method!=='POST'||request.headers.get('origin')!==url.origin)return reply({error:'Use checkout from this app.'},403);
 if(!playReady(env))return reply({error:'Google Play checkout is not configured yet. No payment has been taken.'},503);
 try{const data=await readJson(request),db=env.DB;
  if(url.pathname==='/api/play/intent'){
   if(!Object.hasOwn(PLAY_PRODUCTS,data.kind))return reply({error:'Invalid purchase.'},400);let listing=null;
   if(data.kind==='listing'){listing=await db.prepare('SELECT * FROM notices WHERE id=? AND author_id=?').bind(data.listingId,user.userId).first();if(!listing)return reply({error:'Listing not found.'},404);if(listing.payment_state!=='unpaid')return reply({paid:true});if(listing.status!=='draft')return reply({error:'Only a draft can be paid for.'},409)}
   let intent=data.kind==='listing'?await db.prepare("SELECT * FROM play_intents WHERE listing_id=? AND kind='listing'").bind(listing.id).first():null;
   if(!intent){intent={id:crypto.randomUUID(),product_id:PLAY_PRODUCTS[data.kind]};await db.prepare('INSERT INTO play_intents(id,user_id,kind,listing_id,product_id,created_at) VALUES(?,?,?,?,?,?)').bind(intent.id,user.userId,data.kind,listing?.id||null,intent.product_id,new Date().toISOString()).run()}
   return reply({intentId:intent.id,accountId:await playAccount(user.userId),productId:intent.product_id});
  }
  if(url.pathname==='/api/play/verify'){
   if(typeof data.token!=='string'||data.token.length<10||data.token.length>4096)return reply({error:'Invalid purchase token.'},400);
   const api=await playClient(env),proof=await api('/purchases/productsv2/tokens/'+encodeURIComponent(data.token));return reply(await fulfillPlay(db,proof,data.token,env,user,api));
  }
  return reply({error:'Route not found.'},404);
 }catch{console.error(JSON.stringify({event:'play_request_failed'}));return reply({error:'Purchase could not be verified. Restore purchases or contact support before buying again.'},400)}
}
