import {reply} from './auth.mjs';
import {readJson} from './hub.mjs';
import {client,paypalReady} from './paypal.mjs';
export const KIRI_PLANS={monthly:{price:2,months:1},yearly:{price:12,months:12}};
const money=(value,price)=>value?.currency_code==='AUD'&&typeof value.value==='string'&&/^\d+(?:\.\d{1,2})?$/.test(value.value)&&Number(value.value)===price;
function matching(order,attempt,env){
 const unit=order.purchase_units?.[0],plan=KIRI_PLANS[attempt.plan];
 if(!plan||order.purchase_units?.length!==1||unit.payee?.merchant_id!==env.PAYPAL_MERCHANT_ID||unit.custom_id!=='kiri:'+attempt.user_id||unit.invoice_id!==attempt.id||!money(unit.amount,plan.price))throw Error('The PayPal order does not match this membership.');
 return unit;
}
export async function fulfillMembership(db,order,env){
 const attempt=await db.prepare('SELECT * FROM kiri_checkouts WHERE order_id=?').bind(order.id).first();if(!attempt)return false;
 if(attempt.livemode!==(env.PAYMENT_MODE==='live'?1:0))throw Error('Wrong payment environment.');
 if(order.status!=='COMPLETED')return false;
 const unit=matching(order,attempt,env),capture=unit.payments?.captures?.[0];
 if(capture?.status==='PENDING')return false;
 if(unit.payments?.captures?.length!==1||!capture?.id||capture.status!=='COMPLETED'||!money(capture.amount,KIRI_PLANS[attempt.plan].price))throw Error('The capture does not match this membership.');
 const now=new Date().toISOString(),months=KIRI_PLANS[attempt.plan].months;
 await db.batch([
  db.prepare("UPDATE kiri_checkouts SET state='paid',capture_id=?,paid_at=COALESCE(paid_at,?) WHERE id=? AND (capture_id IS NULL OR capture_id=?)").bind(capture.id,now,attempt.id,capture.id),
  // The transaction and fulfilled_at guard prevent duplicate notifications extending access twice.
  db.prepare(`INSERT INTO kiri_memberships(user_id,state,paid_until,payment_id,confirmed_at,livemode,updated_at)
   SELECT p.user_id,'active',strftime('%Y-%m-%dT%H:%M:%fZ',CASE WHEN m.paid_until>? AND m.livemode=p.livemode THEN m.paid_until ELSE ? END,?,'floor'),p.capture_id,?,p.livemode,?
   FROM kiri_checkouts p LEFT JOIN kiri_memberships m ON m.user_id=p.user_id
   WHERE p.id=? AND p.state='paid' AND p.capture_id=? AND p.fulfilled_at IS NULL
   ON CONFLICT(user_id) DO UPDATE SET state='active',paid_until=excluded.paid_until,payment_id=excluded.payment_id,confirmed_at=excluded.confirmed_at,livemode=excluded.livemode,updated_at=excluded.updated_at`).bind(now,now,'+'+months+' months',now,now,attempt.id,capture.id),
  db.prepare("UPDATE kiri_checkouts SET fulfilled_at=COALESCE(fulfilled_at,?) WHERE id=? AND state='paid' AND capture_id=?").bind(now,attempt.id,capture.id)
 ]);return true;
}
export async function captureMembership(db,env,api,orderId){
 const attempt=await db.prepare('SELECT * FROM kiri_checkouts WHERE order_id=? AND livemode=?').bind(orderId,env.PAYMENT_MODE==='live'?1:0).first();if(!attempt)return {paid:false};
 let order=await api('/v2/checkout/orders/'+encodeURIComponent(orderId));matching(order,attempt,env);
 if(order.status==='APPROVED'){
  await db.prepare("UPDATE kiri_checkouts SET state='processing' WHERE id=? AND state!='paid'").bind(attempt.id).run();
  try{order=await api('/v2/checkout/orders/'+encodeURIComponent(orderId)+'/capture',{},'kiri-capture-'+attempt.id)}catch{order=await api('/v2/checkout/orders/'+encodeURIComponent(orderId));if(order.status!=='COMPLETED')throw Error('Payment is still processing. Reopen Kiri shortly.')}
 }
 return {paid:await fulfillMembership(db,order,env),order};
}
export async function handleMembership(request,env,user){
 const url=new URL(request.url),db=env.DB;
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==url.origin)return reply({error:'Use checkout from this site.'},403);
 if(!user)return reply({error:'Sign in to join Kiri.'},401);
 if(!paypalReady(env))return reply({error:'Membership checkout is unavailable.'},503);
 try{
  const data=await readJson(request),live=env.PAYMENT_MODE==='live'?1:0;
  if(url.pathname==='/api/assistant/membership/capture'){
   if(typeof data.orderId!=='string'||data.orderId.length>100)return reply({error:'Invalid order.'},400);
   const attempt=await db.prepare('SELECT id FROM kiri_checkouts WHERE order_id=? AND user_id=? AND livemode=?').bind(data.orderId,user.userId,live).first();if(!attempt)return reply({error:'Membership order not found.'},404);
   const result=await captureMembership(db,env,await client(env),data.orderId);return reply({paid:result.paid,processing:!result.paid});
  }
  if(url.pathname!=='/api/assistant/membership/checkout')return reply({error:'Route not found.'},404);
  if(!Object.hasOwn(KIRI_PLANS,data.plan))return reply({error:'Choose monthly or yearly membership.'},400);
  const plan=KIRI_PLANS[data.plan],api=await client(env);
  let attempt=await db.prepare("SELECT * FROM kiri_checkouts WHERE user_id=? AND plan=? AND livemode=? AND state IN ('creating','open','processing')").bind(user.userId,data.plan,live).first();
  if(attempt?.order_id){
   const result=await captureMembership(db,env,api,attempt.order_id);if(result.paid)return reply({paid:true});
   if(['CREATED','PAYER_ACTION_REQUIRED'].includes(result.order.status)&&attempt.approval_url)return reply({url:attempt.approval_url,mode:env.PAYMENT_MODE});
   if(['APPROVED','COMPLETED'].includes(result.order.status))return reply({processing:true});
   await db.prepare("UPDATE kiri_checkouts SET state='expired' WHERE id=? AND state!='paid'").bind(attempt.id).run();attempt=null;
  }
  if(!attempt){await db.prepare('INSERT OR IGNORE INTO kiri_checkouts(id,user_id,plan,livemode,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.userId,data.plan,live,new Date().toISOString()).run();attempt=await db.prepare("SELECT * FROM kiri_checkouts WHERE user_id=? AND plan=? AND livemode=? AND state IN ('creating','open','processing')").bind(user.userId,data.plan,live).first()}
  if(!attempt)throw Error('Refresh Kiri and try again.');
  const order=await api('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:attempt.id,custom_id:'kiri:'+user.userId,invoice_id:attempt.id,description:'Kiri membership — '+(data.plan==='monthly'?'one month':'one year')+' — manual renewal',amount:{currency_code:'AUD',value:plan.price.toFixed(2)},payee:{merchant_id:env.PAYPAL_MERCHANT_ID}}],payment_source:{paypal:{experience_context:{brand_name:'Kiribati Connect',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:url.origin+'/?kiri=paid',cancel_url:url.origin+'/?kiri=cancelled'}}}},'kiri-order-'+attempt.id);
  const approval=order.links?.find(link=>['payer-action','approve'].includes(link.rel))?.href;if(!order.id||!approval)throw Error('PayPal did not return a checkout link.');
  const target=new URL(approval);if(target.protocol!=='https:'||target.hostname!==(live?'www.paypal.com':'www.sandbox.paypal.com')||target.username||target.password)throw Error('Unexpected PayPal destination.');
  await db.prepare("UPDATE kiri_checkouts SET order_id=?,approval_url=?,state='open' WHERE id=? AND state='creating'").bind(order.id,approval,attempt.id).run();return reply({url:approval,mode:env.PAYMENT_MODE});
 }catch{console.error(JSON.stringify({event:'kiri_checkout_failed'}));return reply({error:'Membership payment could not be completed. Reopen Kiri to check your membership before retrying.'},400)}
}
