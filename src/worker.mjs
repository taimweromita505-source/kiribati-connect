import {assets} from './assets.generated.mjs';
import {getUser,handleAuth,reply} from './auth.mjs';
import {handleHub} from './hub.mjs';
import {handlePayments} from './payments.mjs';
import {handlePaypal} from './paypal.mjs';
import {identityMetadata} from './play-identity.mjs';
import {handlePlay,reconcilePlay} from './google-play.mjs';
import {handleSafety} from './safety.mjs';
import {handleAssistant} from './assistant.mjs';
import {handleRatings} from './ratings.mjs';
import {handleMembership,captureMembership} from './membership.mjs';
import {handleAlerts,sendWeeklyDigests} from './alerts.mjs';
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Strict-Transport-Security':'max-age=31536000','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: blob:; connect-src 'self'; base-uri 'self'; form-action 'self' https://square.link https://checkout.square.site https://www.paypal.com https://www.sandbox.paypal.com; frame-ancestors 'none'"};
export default {
 async fetch(request,env,ctx){try{
  const url=new URL(request.url),path=url.pathname;
  if(path==='/download/kiribati-connect.apk'||path==='/download/apk'||path==='/app.apk'){
   if(!env.IMAGES)return new Response('APK download unavailable.',{status:503});
   const obj=await env.IMAGES.get('downloads/kiribati-connect.apk');
   if(!obj)return new Response('APK not found.',{status:404});
   return new Response(obj.body,{headers:{...security,'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="kiribati-connect.apk"','Cache-Control':'public, max-age=3600'}});
  }
  if(path==='/api/app/latest.json'){
   return reply({version:'1.3.0',versionCode:4,releaseDate:'2026-11-14',url:'https://kiribaticonnect.app/download/kiribati-connect.apk',notes:'Added Ships and Flights categories, interactive air and sea route map, vessel and air freight tracking, and quick status toggles.'},200,{'Cache-Control':'public, max-age=600'});
  }
  if(path.startsWith('/api/play/identity/'))return identityMetadata(request,env);
  if(path.startsWith('/api/alerts/'))return await handleAlerts(request,env);
  if(path.startsWith('/api/')){
   if(!env.DB||!env.AUTH_PEPPER)return reply({error:'The notice board is temporarily unavailable.'},503);
   const user=await getUser(request,env.DB);
   if(path==='/api/blocks'||path.startsWith('/api/reports'))return await handleSafety(request,env,user);
   if(path.startsWith('/api/auth/'))return await handleAuth(request,env,user);
    if(path==='/api/ratings/summary'||/^\/api\/showcases\/[-a-f0-9]{36}\/ratings$/i.test(path))return await handleRatings(request,env,user);
   if(path.startsWith('/api/play/'))return await handlePlay(request,env,user);
   if(env.PLAY_BILLING_ENABLED!=='false'&&request.headers.get('user-agent')?.includes('KiribatiConnectAndroid/')&&(path.startsWith('/api/payments/')||path.startsWith('/api/assistant/membership/'))&&!path.endsWith('/webhook'))return reply({error:'Use Google Play Billing in the Android app.'},403);
   if(path.startsWith('/api/assistant/membership/'))return await handleMembership(request,env,user);
   if(path.startsWith('/api/assistant/'))return await handleAssistant(request,env,user);
   // Roles come from the database, never from client emails or identity headers.
   const adminEmails=user?.role==='admin'?user.email:'';
   if(path.startsWith('/api/payments/paypal/')||path.startsWith('/api/payments/')&&path!=='/api/payments/webhook'&&env.PAYMENT_PROVIDER==='paypal')return handlePaypal(request,env,user,captureMembership);
   const cache=typeof caches!=='undefined'?caches.default:null;
   const cacheKey=(!user&&path==='/api/notices'&&request.method==='GET'&&cache)?new Request(url.toString(),{method:'GET'}):null;
   if(cacheKey){
    const hit=await cache.match(cacheKey);
    if(hit)return hit;
   }
   const res=path.startsWith('/api/payments/')?await handlePayments(request,env,user):await handleHub(request,env,user);
   if(cacheKey&&res.status===200&&cache){
    ctx?.waitUntil?.(cache.put(cacheKey,res.clone()));
   }
   if(cache&&!['GET','HEAD'].includes(request.method)&&(path.startsWith('/api/notices')||path.startsWith('/api/moderation')||path.startsWith('/api/payments'))){
    ctx?.waitUntil?.(cache.delete(new Request(new URL('/api/notices',url.origin).toString(),{method:'GET'})));
   }
   return res;
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:security});
  const policyRoutes={'/privacy':'/privacy.html','/terms':'/terms.html','/delete-account':'/delete-account.html','/safety':'/safety.html'};
  const key=policyRoutes[path]|| (path==='/'||path==='/index.html'?'/community.html':path==='/login'||path==='/account'?'/auth.html':path.startsWith('/listing/')?'/community.html':path);
  const asset=assets[key];if(!asset)return new Response('Not found',{status:404,headers:security});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{...security,'Content-Type':asset.type,'Cache-Control':'no-cache'}});
 }catch(error){console.error(JSON.stringify({event:'request_failed',message:error instanceof Error?error.message:'Unknown error'}));return reply({error:'The app is temporarily unavailable. Please try again.'},503)}},
 async scheduled(event,env){await reconcilePlay(env);await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM safety_reports WHERE created_at<?').bind(new Date(Date.now()-90*86400000).toISOString()),...['play_purchases','paypal_checkouts','listing_payments','payment_events'].map(table=>env.DB.prepare('DELETE FROM '+table+' WHERE created_at<?').bind(new Date(Date.now()-7*366*86400000).toISOString()))]);await sendWeeklyDigests(env);}
};
