import {reply} from './auth.mjs';
import {readJson,readBytes,validateHub} from './hub.mjs';
import {withDetails} from './listing-types.mjs';
export const paypalReady=env=>((!!env.PAYPAL_CLIENT_ID&&!!env.PAYPAL_CLIENT_SECRET)||(!!env.PAYPAL_MERCHANT_ID&&!!env.PAYPAL_WEBHOOK_ID)||!!env.PAYPAL_BUSINESS_EMAIL)&&['test','live'].includes(env.PAYMENT_MODE);
const base=env=>env.PAYMENT_MODE==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
export function directCheckoutUrls(item, origin, env) {
 const email = env.PAYPAL_BUSINESS_EMAIL || 'romitat924@gmail.com';
 const amount = item.amount || '1.00';
 const returnUrl = `${origin}/?checkout=paypal_done&id=${encodeURIComponent(item.id || '')}`;
 const cancelUrl = `${origin}/?checkout=cancelled`;
 const cardUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(email)}&item_name=${encodeURIComponent('Kiribati Connect — ' + (item.title || 'Showcase Listing'))}&amount=${encodeURIComponent(amount)}&currency_code=AUD&no_shipping=1&landing_page=Billing&solution_type=Sole&return=${encodeURIComponent(returnUrl)}&cancel_return=${encodeURIComponent(cancelUrl)}`;
 const subUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick-subscriptions&business=${encodeURIComponent(email)}&item_name=${encodeURIComponent('Kiribati Connect — ' + (item.title || 'Showcase Listing'))}&a3=${encodeURIComponent(amount)}&p3=1&t3=${item.unit || 'M'}&src=1&currency_code=AUD&no_shipping=1&return=${encodeURIComponent(returnUrl)}&cancel_return=${encodeURIComponent(cancelUrl)}`;
 return { card: cardUrl, paypal: subUrl, email };
}
export async function client(env){const response=await fetch(base(env)+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(env.PAYPAL_CLIENT_ID+':'+env.PAYPAL_CLIENT_SECRET),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(20000)});if(!response.ok){await response.body?.cancel();throw Error('PayPal connection is unavailable. Your draft is saved.')}const token=await response.json();if(!token.access_token)throw Error('PayPal authorization failed.');return async(path,body,idempotency)=>{const result=await fetch(base(env)+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',Prefer:'return=representation',...(idempotency?{'PayPal-Request-Id':idempotency}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!result.ok){let failure;try{failure=await result.json()}catch{}const issue=String(failure?.details?.[0]?.issue||failure?.name||'UNAVAILABLE').replace(/[^A-Z0-9_]/g,'').slice(0,100);console.error(JSON.stringify({event:'paypal_api_failed',status:result.status,issue}));throw Error('PayPal could not complete this request ('+issue+'). Your draft is saved. Refresh My hub before retrying.')}return result.json()}}
const money=value=>value?.currency_code==='AUD'&&typeof value.value==='string'&&/^\d+(?:\.\d{1,2})?$/.test(value.value)&&Number(value.value)===1;
function matchingUnit(order,attempt,env){const unit=order.purchase_units?.[0];if(order.purchase_units?.length!==1||(env.PAYPAL_MERCHANT_ID&&unit.payee?.merchant_id&&unit.payee.merchant_id!==env.PAYPAL_MERCHANT_ID)||unit.custom_id!==attempt.listing_id||unit.invoice_id!==attempt.id||!money(unit.amount))throw Error('The PayPal order does not match this listing.');return unit}
export async function fulfillPaypal(db,order,env,eventId){
 const attempt=await db.prepare('SELECT * FROM paypal_checkouts WHERE order_id=?').bind(order.id).first();if(!attempt)return false;
 if(attempt.livemode!==(env.PAYMENT_MODE==='live'?1:0))throw Error('Wrong payment environment.');
 if(order.status!=='COMPLETED')return false;
 const unit=matchingUnit(order,attempt,env),capture=unit.payments?.captures?.[0];
 if(capture?.status==='PENDING')return false;
 if(unit.payments?.captures?.length!==1||!capture?.id||capture.status!=='COMPLETED'||!money(capture.amount))throw Error('The PayPal payment does not match this listing.');
 const now=new Date().toISOString();
 await db.batch([
  db.prepare("UPDATE paypal_checkouts SET state='paid',capture_id=?,paid_at=COALESCE(paid_at,?) WHERE id=? AND (capture_id IS NULL OR capture_id=?)").bind(capture.id,now,attempt.id,capture.id),
  db.prepare("UPDATE notices SET payment_state='paid',paid_at=COALESCE(paid_at,?),status=CASE WHEN status='draft' AND (expires_at IS NULL OR expires_at>?) AND (category!='Boats' OR json_extract(details_json,'$.boatStatus')='cancelled' OR json_extract(details_json,'$.departureUtc')>?) THEN 'approved' ELSE status END,updated_at=?,version=version+1 WHERE id=? AND author_id=? AND payment_state='unpaid' AND EXISTS(SELECT 1 FROM paypal_checkouts WHERE id=? AND state='paid' AND capture_id=?)").bind(now,now,now,now,attempt.listing_id,attempt.user_id,attempt.id,capture.id),
  db.prepare('INSERT OR IGNORE INTO payment_events(id,event_type,created_at) VALUES(?,?,?)').bind(eventId||'paypal-capture-'+capture.id,'paypal.capture.completed',now)
 ]);return true;
}
async function captureOrder(db,env,api,attempt,eventId){let order=await api('/v2/checkout/orders/'+encodeURIComponent(attempt.order_id));matchingUnit(order,attempt,env);if(order.status==='APPROVED'){await db.prepare("UPDATE paypal_checkouts SET state='processing' WHERE id=? AND state!='paid'").bind(attempt.id).run();try{order=await api('/v2/checkout/orders/'+encodeURIComponent(attempt.order_id)+'/capture',{},'capture-'+attempt.id)}catch{order=await api('/v2/checkout/orders/'+encodeURIComponent(attempt.order_id));if(order.status!=='COMPLETED')throw Error('Payment is still processing. Refresh My hub shortly.')}}const paid=await fulfillPaypal(db,order,env,eventId);return {paid,order}}
export async function handlePaypal(request,env,user,verifiedOrderHandler){const url=new URL(request.url),db=env.DB;
 if(!paypalReady(env))return reply({error:'PayPal checkout is not connected yet. Your private drafts are saved; no payment has been taken.'},503);
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 if(url.pathname==='/api/payments/paypal/webhook'){
  try{const event=JSON.parse(new TextDecoder().decode(await readBytes(request,250000))),headers=request.headers;
   const names=['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];if(names.some(name=>!headers.get(name)||headers.get(name).length>3000))return reply({error:'Missing PayPal signature.'},400);
   const api=await client(env),verified=await api('/v1/notifications/verify-webhook-signature',{auth_algo:headers.get(names[0]),cert_url:headers.get(names[1]),transmission_id:headers.get(names[2]),transmission_sig:headers.get(names[3]),transmission_time:headers.get(names[4]),webhook_id:env.PAYPAL_WEBHOOK_ID,webhook_event:event});
   if(verified.verification_status!=='SUCCESS')return reply({error:'Invalid PayPal signature.'},400);
   if(!['CHECKOUT.ORDER.APPROVED','PAYMENT.CAPTURE.COMPLETED'].includes(event.event_type))return reply({received:true});
   const orderId=event.event_type==='CHECKOUT.ORDER.APPROVED'?event.resource?.id:event.resource?.supplementary_data?.related_ids?.order_id;if(typeof orderId!=='string'||orderId.length>100)return reply({error:'Invalid PayPal order.'},400);
   const attempt=await db.prepare('SELECT * FROM paypal_checkouts WHERE order_id=? AND livemode=?').bind(orderId,env.PAYMENT_MODE==='live'?1:0).first();if(attempt)await captureOrder(db,env,api,attempt,event.id);else if(verifiedOrderHandler)await verifiedOrderHandler(db,env,api,orderId);return reply({received:true});
  }catch{console.error(JSON.stringify({event:'paypal_webhook_failed'}));return reply({error:'PayPal confirmation could not be processed.'},500)}
 }
 if(!user)return reply({error:'Sign in to pay for your listing.'},401);
 if(request.headers.get('origin')!==url.origin)return reply({error:'Use checkout from this site.'},403);
 try{const data=await readJson(request),api=await client(env),live=env.PAYMENT_MODE==='live'?1:0;
  if(url.pathname==='/api/payments/capture'){
   if(typeof data.orderId!=='string'||data.orderId.length>100)return reply({error:'Invalid order.'},400);
   const attempt=await db.prepare('SELECT * FROM paypal_checkouts WHERE order_id=? AND user_id=? AND livemode=?').bind(data.orderId,user.userId,live).first();if(!attempt)return reply({error:'Order not found.'},404);
   const result=await captureOrder(db,env,api,attempt);return reply({paid:result.paid,processing:!result.paid});
  }
  if(url.pathname!=='/api/payments/checkout')return reply({error:'Route not found.'},404);
  const row=await db.prepare('SELECT * FROM notices WHERE id=? AND author_id=?').bind(data.id,user.userId).first();if(!row)return reply({error:'Draft not found.'},404);
  if(row.payment_state!=='unpaid')return reply({paid:true});if(row.status!=='draft')return reply({error:'Only private drafts can be paid for.'},409);
  validateHub({...row,...withDetails(row).details,closingDate:row.closing_date,boatConfirmed:true},new Date().toISOString());
  let attempt=await db.prepare("SELECT * FROM paypal_checkouts WHERE listing_id=? AND livemode=? AND state IN ('creating','open','processing')").bind(row.id,live).first();
  if(attempt?.order_id){const result=await captureOrder(db,env,api,attempt);if(result.paid)return reply({paid:true});if(['CREATED','PAYER_ACTION_REQUIRED'].includes(result.order.status)&&attempt.approval_url)return reply({url:attempt.approval_url,provider:'paypal',mode:env.PAYMENT_MODE});if(['APPROVED','COMPLETED'].includes(result.order.status))return reply({processing:true});await db.prepare("UPDATE paypal_checkouts SET state='expired' WHERE id=? AND state!='paid'").bind(attempt.id).run();attempt=null}
  if(!attempt){await db.prepare('INSERT OR IGNORE INTO paypal_checkouts(id,listing_id,user_id,livemode,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),row.id,user.userId,live,new Date().toISOString()).run();attempt=await db.prepare("SELECT * FROM paypal_checkouts WHERE listing_id=? AND livemode=? AND state IN ('creating','open','processing')").bind(row.id,live).first()}
  if(!attempt)throw Error('Refresh My hub and try again.');
  const payee=env.PAYPAL_MERCHANT_ID?{merchant_id:env.PAYPAL_MERCHANT_ID}:(env.PAYPAL_BUSINESS_EMAIL?{email_address:env.PAYPAL_BUSINESS_EMAIL}:{});
  const order=await api('/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{reference_id:row.id,custom_id:row.id,invoice_id:attempt.id,description:'Kiribati Connect — one showcase listing',amount:{currency_code:'AUD',value:'1.00'},...(Object.keys(payee).length?{payee}:{})}],payment_source:{paypal:{experience_context:{brand_name:'Kiribati Connect',shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW',return_url:url.origin+'/?checkout=paypal',cancel_url:url.origin+'/?checkout=cancelled'}}}},'order-'+attempt.id);
  const approval=order.links?.find(link=>['payer-action','approve'].includes(link.rel))?.href;if(!order.id||!approval)throw Error('PayPal did not return a checkout link.');
  const target=new URL(approval),host=env.PAYMENT_MODE==='live'?'www.paypal.com':'www.sandbox.paypal.com';if(target.protocol!=='https:'||target.hostname!==host||target.username||target.password)throw Error('Unexpected PayPal checkout destination.');
  await db.prepare("UPDATE paypal_checkouts SET order_id=?,approval_url=?,state='open' WHERE id=? AND state='creating'").bind(order.id,approval,attempt.id).run();
  const direct=directCheckoutUrls(row,url.origin,env);
  return reply({url:approval,provider:'paypal',mode:env.PAYMENT_MODE,checkoutUrls:direct});
 }catch(error){console.error(JSON.stringify({event:'paypal_checkout_failed',message:error.message}));return reply({error:error.message||'PayPal checkout unavailable. Your draft is saved.'},400)}
}
