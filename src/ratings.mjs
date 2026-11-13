import {reply} from './auth.mjs';
import {readJson} from './hub.mjs';
import {visibleTo} from './safety.mjs';
const live="n.status='approved' AND (n.expires_at IS NULL OR n.expires_at>?)";
export async function handleRatings(request,env,user){
 const db=env.DB,url=new URL(request.url),path=url.pathname,now=new Date().toISOString();
 if(path==='/api/ratings/summary'&&request.method==='GET'){
  const rows=await db.prepare(`SELECT n.id,n.employer,n.category,AVG(r.stars) AS avg,COUNT(r.stars) AS count FROM notices n JOIN listing_ratings r ON r.listing_id=n.id WHERE ${live} AND ${visibleTo()} GROUP BY n.id`).bind(now,user?.userId||'',user?.userId||'').all();
  const listings={},operators={};
  for(const row of rows.results){listings[row.id]={avg:Math.round(row.avg*10)/10,count:row.count};if(row.employer){const key=row.category+':'+row.employer.trim().toLowerCase(),o=operators[key]||{sum:0,count:0};o.sum+=row.avg*row.count;o.count+=row.count;operators[key]=o}}
  for(const key of Object.keys(operators)){const o=operators[key];operators[key]={avg:Math.round(o.sum/o.count*10)/10,count:o.count}}
  return reply({listings,operators},200,{'Cache-Control':'public, max-age=60'});
 }
 const match=path.match(/^\/api\/showcases\/([-a-f0-9]{36})\/ratings$/i);
 if(!match)return reply({error:'Route not found.'},404);
 const id=match[1];
 const listing=await db.prepare(`SELECT n.id,n.author_id,n.category FROM notices n WHERE n.id=? AND ${live} AND ${visibleTo()}`).bind(id,now,user?.userId||'',user?.userId||'').first();
 if(!listing)return reply({error:'This listing is unavailable.'},404);
 if(request.method==='GET'){
  const rows=await db.prepare('SELECT r.stars,r.review,r.created_at,u.name AS displayName FROM listing_ratings r JOIN users u ON u.id=r.user_id WHERE r.listing_id=? ORDER BY r.created_at DESC LIMIT 50').bind(id).all();
  const total=await db.prepare('SELECT AVG(stars) AS avg,COUNT(*) AS count FROM listing_ratings WHERE listing_id=?').bind(id).first();
  return reply({avg:total.count?Math.round(total.avg*10)/10:null,count:total.count,ratings:rows.results});
 }
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==url.origin)return reply({error:'Please submit from this site.'},403);
 if(!user)return reply({error:'Sign in or create a free account to rate.'},401);
 if(user.userId===listing.author_id)return reply({error:'You cannot rate your own listing.'},403);
 let data;try{data=await readJson(request)}catch{return reply({error:'Send a valid rating.'},400)}
 const stars=data?.stars,review=typeof data?.review==='string'?data.review.trim():'';
 if(!Number.isInteger(stars)||stars<1||stars>5||review.length>500)return reply({error:'Choose 1 to 5 stars and keep the review under 500 characters.'},400);
 await db.prepare('INSERT INTO listing_ratings(listing_id,user_id,stars,review,created_at) VALUES(?,?,?,?,?) ON CONFLICT(listing_id,user_id) DO UPDATE SET stars=excluded.stars,review=excluded.review,created_at=excluded.created_at').bind(id,user.userId,stars,review,now).run();
 return reply({ok:true},201);
}
