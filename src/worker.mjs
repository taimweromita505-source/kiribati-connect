import {assets} from './assets.generated.mjs';
import {getUser,handleAuth,reply} from './auth.mjs';
import {handleHub} from './hub.mjs';
import {handlePayments} from './payments.mjs';
import {handlePaypal} from './paypal.mjs';
import {handleAssistant} from './assistant.mjs';
import {handleMembership,captureMembership} from './membership.mjs';
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Strict-Transport-Security':'max-age=31536000','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: blob:; connect-src 'self'; base-uri 'self'; form-action 'self' https://square.link https://checkout.square.site https://www.paypal.com https://www.sandbox.paypal.com; frame-ancestors 'none'"};
export default {
 async fetch(request,env,ctx){try{
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/api/')){
   if(!env.DB||!env.AUTH_PEPPER)return reply({error:'The notice board is temporarily unavailable.'},503);
   const user=await getUser(request,env.DB);
   if(path.startsWith('/api/auth/'))return await handleAuth(request,env,user);
   if(path.startsWith('/api/assistant/membership/'))return await handleMembership(request,env,user);
   if(path.startsWith('/api/assistant/'))return await handleAssistant(request,env,user);
   // Roles come from the database, never from client emails or identity headers.
   const adminEmails=user?.role==='admin'?user.email:'';
   if(path.startsWith('/api/payments/paypal/')||path.startsWith('/api/payments/')&&path!=='/api/payments/webhook'&&env.PAYMENT_PROVIDER==='paypal')return handlePaypal(request,env,user,captureMembership);
   return path.startsWith('/api/payments/')?handlePayments(request,env,user):handleHub(request,env,user);
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:security});
  const key=path==='/'||path==='/index.html'?'/community.html':path==='/login'||path==='/account'?'/auth.html':path.startsWith('/listing/')?'/community.html':path;
  const asset=assets[key];if(!asset)return new Response('Not found',{status:404,headers:security});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{...security,'Content-Type':asset.type,'Cache-Control':'no-cache'}});
 }catch(error){console.error(JSON.stringify({event:'request_failed',message:error instanceof Error?error.message:'Unknown error'}));return reply({error:'The app is temporarily unavailable. Please try again.'},503)}},
 async scheduled(event,env){await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now())]);}
};
