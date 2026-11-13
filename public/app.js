const $=s=>document.querySelector(s);const categories=['All updates','Jobs','Boats','Community','Government','Marketplace'];const icons=['⌂','↗','≈','☷','▤','▧'];let view='All updates',savedOnly=false;function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}let saved=read('kc-saved',[]),notices=read('kc-approved-v5',[]);function persist(){try{localStorage.setItem('kc-saved',JSON.stringify(saved));localStorage.setItem('kc-notices',JSON.stringify(notices))}catch{toast('Device storage is unavailable. Changes last for this session.')}}
const samples=[{id:'c1',category:'Community',title:'A cleaner shore starts with us',body:'Join a community beach clean-up and help keep our lagoon beautiful. Bring a reusable bottle and a friend.',island:'South Tarawa',source:'Community board · Sample',detail:'Example notice only. A real event would include an organiser, verified date, meeting point, and contact details.'},{id:'j1',category:'Jobs',title:'Community outreach assistant',body:'A sample opportunity for someone who enjoys working with people and supporting local projects.',island:'South Tarawa',source:'Job board · Sample',detail:'Example vacancy only; no employer or open position is represented. Real listings need an employer, closing date, pay details, and an application contact.'},{id:'b1',category:'Boats',title:'Tarawa → Abaiang',body:'Sample departure · 7:00 AM · Passenger service. A simple place to find your next island connection.',island:'Abaiang',source:'Boat schedules · Unverified sample',detail:'No actual sailing is confirmed. Before travelling, verify departure date, port, fares, availability, weather, and last-minute changes directly with the operator.'},{id:'g1',category:'Government',title:'Public service updates, in one place',body:'A dedicated space for verified announcements, service hours, and important community information.',island:'South Tarawa',source:'Government · Sample',detail:'This is a sample announcement, not an official government notice. Production posts should link to their original official source.'},{id:'m1',category:'Marketplace',title:'Locally made woven baskets',body:'A preview of a local marketplace: handmade goods, useful finds, and connections close to home.',island:'North Tarawa',source:'Marketplace · Sample',detail:'Example listing only. There is no item for sale or seller to contact in this prototype.'},{id:'b2',category:'Boats',title:'Tarawa → Maiana',body:'Sample departure · 9:30 AM · Check the latest operator update before heading to the wharf.',island:'Maiana',source:'Boat schedules · Unverified sample',detail:'Illustrative schedule only. No departure date or real operator is connected.'},{id:'c2',category:'Community',title:'A space for Kiritimati community news',body:'Share local events, practical updates, and opportunities from your island.',island:'Kiritimati',source:'Community board · Sample',detail:'Example only. Sign in and choose Create a listing to save your own private draft.'}];
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',5000)}function choose(next){if(location.pathname.startsWith('/listing/')){location.assign('/?category='+encodeURIComponent(next));return}view=next;savedOnly=false;$('#saved').textContent='♡ Saved';render()}function element(tag,cls,text){let e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e}

let myIsland=localStorage.getItem('kc-my-island')||'';
let reliableOnly=false;
let dataSaver=localStorage.getItem('kc-data-saver')==='1'||(localStorage.getItem('kc-data-saver')===null&&navigator.connection?.saveData===true);
window.ratingSummary=read('kc-ratings',{listings:{},operators:{}});
function ratingFor(x){const s=window.ratingSummary||{listings:{},operators:{}};return {own:s.listings?.[x.id],op:x.employer?s.operators?.[x.category+':'+x.employer.trim().toLowerCase()]:null}}
function updatePinBtn(){
 const pin=$('#pin-island'),current=$('#island')?.value;
 if(!pin)return;
 const isPinned=myIsland&&current===myIsland&&current!=='All islands';
 pin.textContent=isPinned?'📍':'📌';
 pin.setAttribute('aria-pressed',isPinned?'true':'false');
 pin.title=isPinned?'Pinned as My Island: '+myIsland:'Pin '+current+' as My Island';
}

function updateSyncedTime(){
 const synced=localStorage.getItem('kc-last-synced');
 if(!synced)return;
 const diff=Math.round((Date.now()-Date.parse(synced))/60000);
 const text=diff<1?'Synced just now':diff<60?('Synced '+diff+'m ago'):('Synced '+new Date(synced).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
 const el=$('#feed-synced');if(el)el.textContent=text;
 const cacheEl=$('#cache-status');if(cacheEl&&!navigator.onLine)cacheEl.textContent='Offline · '+text;
}
window.updateSyncedTime=updateSyncedTime;

function boatStatusBadge(item){
 if(item.category!=='Boats')return null;
 const details=item.details||{},status=details.boatStatus||'scheduled';
 const refDate=item.confirmed_at||item.updated_at||item.created_at;
 const ageDays=refDate?(Date.now()-Date.parse(refDate))/86400000:999;
 const depDate=details.departureLocal?Date.parse(details.departureLocal):null;
 if(status==='cancelled'||(depDate&&depDate<Date.now())||ageDays>7){
  return {cls:'outdated',text:'🔴 Outdated (>7d)'};
 }
 if(details.boatConfirmed||item.source_verified){
  return {cls:'verified',text:'🟢 Verified'};
 }
 return {cls:'community-checked',text:'🟡 Community-checked'};
}

function render(){
 $('#nav').replaceChildren(...categories.map((c,i)=>{let b=element('button',view===c?'active':'');b.append(element('span','',icons[i]),document.createTextNode(c==='All updates'?'Home':c==='Boats'?'Boat schedules':c));b.onclick=()=>choose(c);b.setAttribute('aria-pressed',view===c);return b}));
 $('#filters').replaceChildren(...categories.map(c=>{let b=element('button',view===c?'active':'',c);b.onclick=()=>choose(c);b.setAttribute('aria-pressed',view===c);return b}));
 $('#heading').textContent=savedOnly?'Your saved updates':view==='All updates'?'The latest in your community':view==='Boats'?'Find your next island crossing':view==='Jobs'?'Opportunities close to home':view+' updates';
 let q=$('#search').value.toLowerCase(),island=$('#island').value;
 let rows=[...notices,...($('#show-examples')?.checked?samples:[])].filter(x=>(!x.expires_at||Date.parse(x.expires_at)>Date.now())&&(view==='All updates'||x.category===view)&&matchesListingIsland(x,island)&&(!savedOnly||saved.includes(x.id))&&[x.title,x.body,x.island,x.employer||'',JSON.stringify(x.details||{})].join(' ').toLowerCase().includes(q));
 if(reliableOnly)rows=rows.filter(x=>{const r=ratingFor(x);return (r.op||r.own)?.avg>=4}).sort((a,b)=>{const ra=ratingFor(a),rb=ratingFor(b);return (rb.op||rb.own).avg-(ra.op||ra.own).avg});
 $('#feed-count').textContent=rows.length+' '+(rows.length===1?'listing':'listings')+(island==='All islands'?' across the islands':' in '+island);
 $('#feed').replaceChildren(...rows.map(x=>{
  let card=element('article','card'),top=element('div','card-top'),save=element('button','save',saved.includes(x.id)?'♥':'♡');
  save.setAttribute('aria-label',(saved.includes(x.id)?'Unsave ':'Save ')+x.title);
  save.onclick=()=>{saved=saved.includes(x.id)?saved.filter(id=>id!==x.id):[...saved,x.id];persist();render()};
  top.append(element('span','tag '+x.category,x.category),save);
  if(!x.showcaseUrl)top.insertBefore(element('span','example-badge','EXAMPLE'),save);
  let bottom=element('div','card-bottom');
  if(x.showcaseUrl){const showcase=element('a','source-link','Open listing & comments ↗');showcase.href=x.showcaseUrl;showcase.classList.add('card-link');card.append(showcase)}
  let detail=element('button','detail','View details ↗');detail.setAttribute('aria-expanded','false');
  detail.onclick=()=>{
   let old=card.querySelector('.detail-text');
   if(old){old.remove();detail.setAttribute('aria-expanded','false');detail.textContent='View details ↗'}
   else{const block=element('div','detail-text');block.append(element('p','',x.detail||'Example listing.'));const sourceLink=listingSourceLink(x);if(sourceLink)block.append(sourceLink);card.append(block);detail.setAttribute('aria-expanded','true');detail.textContent='Close details ↑'}
  };
  bottom.append(element('span','',x.island+' · '+(x.showcaseUrl?listingDate(x.updated_at||x.created_at):'Example only')),detail);
  card.append(top,element('h3','',x.title));
  if(x.employer)card.append(element('p','publisher-line',x.employer));
  card.append(element('p','card-description',x.body));if(x.contact){const c=contactActions(x.contact);if(c)card.append(c)}card.append(bottom);
  const summary=listingSummary(x);
  if(summary){
   const badge=boatStatusBadge(x);
   const highlightCls='listing-highlight '+(x.details?.boatStatus||'')+(badge?' status-'+badge.cls:'');
   card.insertBefore(element('p',highlightCls,summary),card.querySelector('p'));
  }
  const photo=listingPhoto(x);
  if(photo)card.insertBefore(photo,bottom);
  const rate=ratingFor(x),shown=rate.op||rate.own;
  if(shown)card.insertBefore(element('p','rating-line','⭐ '+shown.avg.toFixed(1)+' · '+shown.count+(shown.count===1?' rating':' ratings')+(rate.op?' for this operator':'')),bottom);
  return card;
 }));
 if(!rows.length)$('#feed').append(element('p','empty','No listings here yet. Try another island, clear your search, or be the first to share something with your community.'));
 updateSyncedTime();
}

$('#show-examples').onchange=render;
const saverBox=$('#data-saver');if(saverBox){saverBox.checked=dataSaver;saverBox.onchange=()=>{dataSaver=saverBox.checked;localStorage.setItem('kc-data-saver',dataSaver?'1':'0');render();toast(dataSaver?'Data saver on: photos load when you tap them.':'Data saver off.')}}
const reliableBox=$('#most-reliable');if(reliableBox)reliableBox.onchange=()=>{reliableOnly=reliableBox.checked;render()};
$('#search').oninput=render;
$('#island').onchange=()=>{updatePinBtn();updateWeather($('#island').value);render();};
const pinBtn=$('#pin-island');
if(pinBtn){
 pinBtn.onclick=()=>{
  const current=$('#island')?.value;
  if(!current||current==='All islands')return toast('Choose a specific island first to pin as My Island.');
  if(myIsland===current){myIsland='';localStorage.removeItem('kc-my-island');toast('Unpinned My Island.');}
  else{myIsland=current;localStorage.setItem('kc-my-island',current);toast('Pinned '+current+' as My Island.');}
  updatePinBtn();
 };
}

function applyTheme(t){
 const dark=t==='dark'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
 document.body.classList.toggle('theme-dark',dark);
 const btn=$('#theme-toggle');
 if(btn){btn.textContent=dark?'☀️':'🌙';btn.title=dark?'Switch to light mode':'Switch to dark / battery saver mode';}
}
let currentTheme=localStorage.getItem('kc-theme')||'auto';
applyTheme(currentTheme);
const themeBtn=$('#theme-toggle');
if(themeBtn){
 themeBtn.onclick=()=>{
  currentTheme=document.body.classList.contains('theme-dark')?'light':'dark';
  localStorage.setItem('kc-theme',currentTheme);
  applyTheme(currentTheme);
  toast(currentTheme==='dark'?'Dark / battery-saver mode enabled':'Light mode enabled');
 };
}

$('#saved').onclick=()=>{savedOnly=!savedOnly;$('#saved').textContent=savedOnly?'♥ Showing saved':'♡ Saved';render()};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{choose(b.dataset.view);$('#heading').scrollIntoView({behavior:'smooth',block:'center'})});
$('#post').onclick=()=>$('#dialog').showModal();
$('.close').onclick=()=>$('#dialog').close();
$('#alerts').onclick=()=>toast('Live notifications are coming soon. For now, open the app to see the latest listings.');
function online(){ $('#connection').textContent=navigator.onLine?'You’re online':'Offline · Cached updates';$('.dot').style.background=navigator.onLine?'#58a879':'#d8a64a';updateSyncedTime();}
const categoryParam=new URLSearchParams(location.search).get('category');
if(categories.includes(categoryParam))view=categoryParam;
window.addEventListener('online',online);
window.addEventListener('offline',online);
if(myIsland&&$('#island')){
 const option=Array.from($('#island').options).find(o=>o.value===myIsland);
 if(option){$('#island').value=myIsland;}
}
updatePinBtn();
online();
render();updateWeather($('#island')?.value||'South Tarawa');
if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(()=>$('#cache-status').textContent='Offline access ready on this device.').catch(()=>$('#cache-status').textContent='Offline access unavailable in this browser.')}else $('#cache-status').textContent='Offline caching needs a supported browser.';

function matchesListingIsland(item,island){if(island==='All islands')return true;const members=[island,...($('#island').selectedOptions[0].dataset.members||'').split('|')];return members.includes(item.island)||members.includes(item.details?.destinationIsland)}

function contactActions(contact){
 if(!contact||typeof contact!=='string')return null;
 const digits=contact.replace(/[^0-9]/g,'');
 let phone=null;
 if(digits.length>=7&&digits.length<=12){
  phone=digits.startsWith('686')?digits:('686'+digits.replace(/^0+/,''));
 }
 const emailMatch=contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
 const wrap=element('div','card-contact-actions');
 if(phone){
  const wa=element('a','contact-btn wa-btn','💬 WhatsApp');
  wa.href='https://wa.me/'+phone;
  wa.target='_blank';wa.rel='noopener noreferrer';
  const call=element('a','contact-btn call-btn','📞 Call');
  call.href='tel:+'+phone;
  const sms=element('a','contact-btn sms-btn','✉️ SMS');
  sms.href='sms:+'+phone;
  wrap.append(wa,call,sms);
 }
 if(emailMatch){
  const mail=element('a','contact-btn mail-btn','✉️ Email');
  mail.href='mailto:'+emailMatch[0];
  wrap.append(mail);
 }
 return wrap.children.length?wrap:null;
}

const islandCoords={
 'South Tarawa':{lat:1.33,lon:172.98,label:'Tarawa Lagoon'},
 'North Tarawa':{lat:1.50,lon:173.00,label:'Tarawa Atoll'},
 'Abaiang':{lat:1.83,lon:172.95,label:'Abaiang Lagoon'},
 'Kiritimati':{lat:1.87,lon:-157.43,label:'Kiritimati Waters'},
 'default':{lat:1.33,lon:172.98,label:'Gilbert Islands'}
};
async function updateWeather(island){
 const box=$('#weather-box'),title=$('#weather-title'),info=$('#weather-info'),meta=$('#weather-meta');
 if(!box||!title)return;
 const loc=islandCoords[island]||islandCoords['default'];
 try{
  const res=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+loc.lat+'&longitude='+loc.lon+'&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto');
  if(!res.ok)return;
  const d=await res.json(),cur=d.current;
  const temp=Math.round(cur.temperature_2m),wind=Math.round(cur.wind_speed_10m);
  const condition=wind>28?'🔴 Rough winds — check with operator':wind>18?'🟡 Moderate breeze — check swell':'🟢 Gentle lagoon breeze — good crossing';
  title.textContent=loc.label+' · '+temp+'°C';
  info.textContent='Wind: '+wind+' km/h · '+condition;
  meta.textContent='Live marine & weather · Confirm with operator before wharf departure';
 }catch{}
}

function listingPhoto(item){
 const src=item.images?.[0]||(item.category==='Marketplace'?item.details?.photoUrl:null);if(!src)return null;
 const build=()=>{const photo=element('img','listing-photo');photo.src=src;photo.alt=item.title;photo.loading='lazy';photo.decoding='async';photo.referrerPolicy='no-referrer';photo.onerror=()=>photo.remove();return photo};
 if(!dataSaver)return build();
 const holder=element('button','secondary photo-saver','🖼 Tap to load photo (saves data)');holder.type='button';
 holder.onclick=()=>holder.replaceWith(build());return holder;
}
function listingSourceLink(item){if(item.category!=='Government'||!item.details?.sourceUrl)return null;const link=element('a','source-link','Open official source ↗');link.href=item.details.sourceUrl;link.target='_blank';link.rel='noopener noreferrer nofollow';return link}
function listingSummary(item){
 const details=item.details;
 if(!details)return item.category==='Jobs'&&item.closing_date?'Applications close '+item.closing_date:'';
 if(item.category==='Jobs'){
  const closing='Applications close '+item.closing_date;
  const lastConf=item.confirmed_at||item.updated_at;
  return closing+(lastConf?' · Checked '+listingDate(lastConf):'');
 }
 if(item.category==='Boats'){
  const badge=boatStatusBadge(item);
  const badgePrefix=badge?badge.text+' · ':'';
  return badgePrefix+(details.boatStatus||'scheduled').toUpperCase()+' · '+item.island+' → '+details.destinationIsland+' · '+details.departureLocal?.replace('T',' ')+' (UTC+'+details.utcOffset+')';
 }
 if(item.category==='Marketplace')return details.currency+' '+Number(details.price).toFixed(2)+' · '+details.availability;
 return '';
}

function listingDate(value){if(!value||!Number.isFinite(Date.parse(value)))return 'Community listing';return 'Updated '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Pacific/Tarawa'}).format(new Date(value))}

const alertsDialog=$('#alerts-dialog');
if(alertsDialog){
 $('#alerts').onclick=()=>{alertsDialog.showModal();const p=read('kc-alert-prefs',{});if(p.email)$('#alert-email').value=p.email;if(p.boats!=null)$('#alert-boats').checked=p.boats;if(p.jobs!=null)$('#alert-jobs').checked=p.jobs;if(p.digest!=null)$('#alert-digest').checked=p.digest;};
 $('#close-alerts').onclick=()=>alertsDialog.close();
 $('#alerts-form').onsubmit=event=>{
  event.preventDefault();
  const email=$('#alert-email').value.trim();
  const prefs={email,boats:$('#alert-boats').checked,jobs:$('#alert-jobs').checked,digest:$('#alert-digest').checked,island:$('#island')?.value||'All islands'};
  try{localStorage.setItem('kc-alert-prefs',JSON.stringify(prefs))}catch{}
  alertsDialog.close();
  toast('Alert preferences saved for '+prefs.island+'!');
 };
}
