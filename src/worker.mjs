import {assets} from './assets.generated.mjs';
import {getUser,handleAuth,reply} from './auth.mjs';
import {handleApi} from './notices.mjs';
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Strict-Transport-Security':'max-age=31536000'};
export default {
 async fetch(request,env,ctx){try{
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/api/')){
   if(!env.DB||!env.AUTH_PEPPER)return reply({error:'The notice board is temporarily unavailable.'},503);
   const user=await getUser(request,env.DB);
   if(path.startsWith('/api/auth/'))return await handleAuth(request,env,user);
   // Roles come from the database, never from client emails or identity headers.
   const adminEmails=user?.role==='admin'?user.email:'';
   return handleApi(request,env.DB,user,adminEmails);
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:security});
  const key=path==='/'||path==='/index.html'?'/community.html':path==='/login'||path==='/account'?'/auth.html':path;
  const asset=assets[key];if(!asset)return new Response('Not found',{status:404,headers:security});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{...security,'Content-Type':asset.type,'Cache-Control':'no-cache'}});
 }catch(error){console.error(JSON.stringify({event:'request_failed',message:error instanceof Error?error.message:'Unknown error'}));return reply({error:'The app is temporarily unavailable. Please try again.'},503)}},
 async scheduled(event,env){await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now())]);}
};
