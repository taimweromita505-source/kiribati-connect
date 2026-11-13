import {reply} from './auth.mjs';
import {readBytes,readJson,validateHub} from './hub.mjs';
import {withDetails} from './listing-types.mjs';
const encoder=new TextEncoder();
export async function verifiedEvent(raw,signature,secret,notificationUrl){
 if(!signature||!secret||!notificationUrl)throw Error('Invalid webhook configuration.');
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 let bytes;try{bytes=Uint8Array.from(atob(signature),char=>char.charCodeAt(0))}catch{throw Error('Invalid signature.')}
 if(!await crypto.subtle.verify('HMAC',key,bytes,encoder.encode(notificationUrl+raw)))throw Error('Invalid signature.');
 return JSON.parse(raw);
}
export const paymentReady=env=>!!env.SQUARE_ACCESS_TOKEN&&!!env.SQUARE_WEBHOOK_SECRET&&!!env.SQUARE_LOCATION_ID&&!!env.SQUARE_WEBHOOK_URL&&['test','live'].includes(env.PAYMENT_MODE);
async function square(env,path,body){const base=env.PAYMENT_MODE==='live'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';const response=await fetch(base+'/v2/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Square-Version':'2026-09-16','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!response.ok){await response.body?.cancel();throw Error('Square checkout is temporarily unavailable. Your draft is saved.')}return response.json()}
export async function fulfillPayment(db,payment,mode,eventId){
 if(!payment?.order_id)return;
 const attempt=await db.prepare('SELECT * FROM listing_payments WHERE order_id=?').bind(payment.order_id).first();if(!attempt)return;
 if(attempt.livemode!==(mode==='live'?1:0)||payment.location_id!==attempt.location_id)throw Error('Payment location or environment does not match.');
 if(payment.status!=='COMPLETED')return;
 if(payment.amount_money?.amount!==100||payment.amount_money?.currency!=='AUD'||payment.total_money?.amount!==100||payment.total_money?.currency!=='AUD'||(payment.refunded_money?.amount||0)>0)throw Error('Unexpected payment amount or currency.');
 const now=new Date().toISOString();
 await db.batch([
  db.prepare("UPDATE listing_payments SET state='paid',paid_at=COALESCE(paid_at,?),payment_intent=? WHERE id=? AND (payment_intent IS NULL OR payment_intent=?)").bind(now,payment.id,attempt.id,payment.id),
  db.prepare("UPDATE notices SET payment_state='paid',paid_at=COALESCE(paid_at,?),status=CASE WHEN status='draft' AND (expires_at IS NULL OR expires_at>?) AND (category NOT IN ('Boats','Ships','Flights') OR json_extract(details_json,'$.boatStatus')='cancelled' OR json_extract(details_json,'$.departureUtc')>?) THEN 'approved' ELSE status END,updated_at=?,version=version+1 WHERE id=? AND author_id=? AND payment_state='unpaid' AND EXISTS(SELECT 1 FROM listing_payments WHERE id=? AND state='paid' AND payment_intent=?)").bind(now,now,now,now,attempt.listing_id,attempt.user_id,attempt.id,payment.id),
  db.prepare('INSERT OR IGNORE INTO payment_events(id,event_type,created_at) VALUES(?,?,?)').bind(eventId||'payment-'+payment.id,'square.payment.completed',now)
 ]);
}
export async function handlePayments(request,env,user){const url=new URL(request.url),db=env.DB;
 if(url.pathname==='/api/payments/webhook'){
  if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
  if(!paymentReady(env))return reply({error:'Payments are not configured.'},503);
  let event;try{event=await verifiedEvent(new TextDecoder().decode(await readBytes(request,250000)),request.headers.get('x-square-hmacsha256-signature'),env.SQUARE_WEBHOOK_SECRET,env.SQUARE_WEBHOOK_URL)}catch{return reply({error:'Invalid Square payment signature.'},400)}
  if(!['payment.created','payment.updated'].includes(event.type))return reply({received:true});
  const id=event.data?.object?.payment?.id;if(typeof id!=='string'||id.length>200)return reply({error:'Invalid payment event.'},400);
  try{const {payment}=await square(env,'payments/'+encodeURIComponent(id));if(payment.location_id!==env.SQUARE_LOCATION_ID)return reply({received:true});await fulfillPayment(db,payment,env.PAYMENT_MODE,event.event_id);return reply({received:true})}catch{console.error(JSON.stringify({event:'square_payment_event_failed',id:event.event_id}));return reply({error:'Payment confirmation could not be processed.'},500)}
 }
 if(!user)return reply({error:'Sign in before paying.'},401);
 if(request.headers.get('origin')!==url.origin)return reply({error:'Use checkout from this site.'},403);
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 if(!paymentReady(env))return reply({error:'Square checkout is not connected yet. Your draft is saved; no payment has been taken.'},503);
 try{
 const {id}=await readJson(request),row=await db.prepare('SELECT * FROM notices WHERE id=? AND author_id=?').bind(id,user.userId).first();if(!row)return reply({error:'Draft not found.'},404);
 if(row.payment_state!=='unpaid')return reply({error:'This listing is already paid. Publish it from My hub.'},409);
 if(row.status!=='draft')return reply({error:'Only active drafts can be paid for.'},409);
 validateHub({...row,...withDetails(row).details,closingDate:row.closing_date,boatConfirmed:true},new Date().toISOString());
 let attempt=await db.prepare("SELECT * FROM listing_payments WHERE listing_id=? AND state IN ('creating','open','processing')").bind(id).first();
 if(attempt&&attempt.livemode!==(env.PAYMENT_MODE==='live'?1:0))throw Error('This draft has a checkout in another environment. Create a separate draft.');
 if(attempt?.checkout_url)return reply({url:attempt.checkout_url,mode:env.PAYMENT_MODE});
 if(!attempt){await db.prepare('INSERT OR IGNORE INTO listing_payments(id,listing_id,user_id,created_at,livemode,location_id) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,user.userId,new Date().toISOString(),env.PAYMENT_MODE==='live'?1:0,env.SQUARE_LOCATION_ID).run();attempt=await db.prepare("SELECT * FROM listing_payments WHERE listing_id=? AND state IN ('creating','open','processing')").bind(id).first()}
 if(!attempt)return reply({error:'Refresh My hub and try again.'},409);
 const params={idempotency_key:attempt.id,description:'Listing '+id,order:{location_id:env.SQUARE_LOCATION_ID,reference_id:attempt.id,line_items:[{name:'Kiribati Connect — one showcase listing',quantity:'1',base_price_money:{amount:100,currency:'AUD'}}]},payment_note:'Kiribati Connect listing '+id,checkout_options:{redirect_url:url.origin+'/?checkout=success',allow_tipping:false,ask_for_shipping_address:false,enable_coupon:false,enable_loyalty:false,accepted_payment_methods:{google_pay:true,apple_pay:true,afterpay_clearpay:false,cash_app_pay:false}}};
 const {payment_link:link}=await square(env,'online-checkout/payment-links',params);
 if(!link?.id||!link.order_id||!link.url)throw Error('Square did not return a payment link.');
 const target=new URL(link.url);if(target.protocol!=='https:'||!['square.link','checkout.square.site',...(env.PAYMENT_MODE==='test'?['sandbox.square.link']:[])].includes(target.hostname))throw Error('Unexpected checkout URL.');
 await db.prepare("UPDATE listing_payments SET session_id=?,order_id=?,checkout_url=?,state=CASE WHEN state='creating' THEN 'open' ELSE state END WHERE id=?").bind(link.id,link.order_id,link.url,attempt.id).run();return reply({url:link.url,mode:env.PAYMENT_MODE});
 }catch(error){console.error(JSON.stringify({event:'square_checkout_failed',message:error.message}));return reply({error:error.message||'Square checkout unavailable. Your draft is saved.'},400)}
}
