const $=s=>document.querySelector(s);const categories=['All updates','Jobs','Boats','Community','Marketplace'];const icons=['⌂','↗','≈','☷','▧'];let view='All updates',savedOnly=false;function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}let saved=read('kc-saved',[]),notices=read('kc-approved-v5',[]);function persist(){try{localStorage.setItem('kc-saved',JSON.stringify(saved));localStorage.setItem('kc-notices',JSON.stringify(notices))}catch{toast('Device storage is unavailable. Changes last for this session.')}}
const samples=[{id:'c1',category:'Community',title:'A cleaner shore starts with us',body:'Join a community beach clean-up and help keep our lagoon beautiful. Bring a reusable bottle and a friend.',island:'South Tarawa',source:'Community board · Sample',detail:'Example notice only. A real event would include an organiser, verified date, meeting point, and contact details.'},{id:'j1',category:'Jobs',title:'Community outreach assistant',body:'A sample opportunity for someone who enjoys working with people and supporting local projects.',island:'South Tarawa',source:'Job board · Sample',detail:'Example vacancy only; no employer or open position is represented. Real listings need an employer, closing date, pay details, and an application contact.'},{id:'b1',category:'Boats',title:'Tarawa → Abaiang',body:'Sample departure · 7:00 AM · Passenger service. A simple place to find your next island connection.',island:'Abaiang',source:'Boat schedules · Unverified sample',detail:'No actual sailing is confirmed. Before travelling, verify departure date, port, fares, availability, weather, and last-minute changes directly with the operator.'},{id:'m1',category:'Marketplace',title:'Locally made woven baskets',body:'A preview of a local marketplace: handmade goods, useful finds, and connections close to home.',island:'North Tarawa',source:'Marketplace · Sample',detail:'Example listing only. There is no item for sale or seller to contact in this prototype.'},{id:'b2',category:'Boats',title:'Tarawa → Maiana',body:'Sample departure · 9:30 AM · Check the latest operator update before heading to the wharf.',island:'Maiana',source:'Boat schedules · Unverified sample',detail:'Illustrative schedule only. No departure date or real operator is connected.'},{id:'c2',category:'Community',title:'A space for Kiritimati community news',body:'Share local events, practical updates, and opportunities from your island.',island:'Kiritimati',source:'Community board · Sample',detail:'Example only. Sign in and choose Create a listing to save your own private draft.'}];
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
  let tagText=x.category;
  if(x.status==='closed')tagText+=(x.category==='Boats'?' · DEPARTED 🚢':x.category==='Jobs'?' · FILLED ✓':' · SOLD 🏷️');
  top.append(element('span','tag '+x.category+(x.status==='closed'?' status-closed':''),tagText),save);
  if(!x.showcaseUrl)top.insertBefore(element('span','example-badge','EXAMPLE'),save);
  let bottom=element('div','card-bottom');
  if(x.showcaseUrl){const showcase=element('a','source-link','Open listing & comments ↗');showcase.href=x.showcaseUrl;showcase.classList.add('card-link');card.append(showcase)}
  let detail=element('button','detail','View details ↗');detail.setAttribute('aria-expanded','false');
  detail.onclick=()=>{
   let old=card.querySelector('.detail-text');
   if(old){old.remove();detail.setAttribute('aria-expanded','false');detail.textContent='View details ↗'}
   else{const block=element('div','detail-text');block.append(element('p','',x.detail||'Example listing.'));const sourceLink=listingSourceLink(x);if(sourceLink)block.append(sourceLink);card.append(block);detail.setAttribute('aria-expanded','true');detail.textContent='Close details ↑'}
  };
  const shareBtn=element('button','share-card-btn','Share ↗');
  shareBtn.setAttribute('aria-label','Share '+x.title);
  shareBtn.onclick=e=>{e.stopPropagation();openShareModal(x)};
  bottom.append(element('span','',x.island+' · '+(x.showcaseUrl?listingDate(x.updated_at||x.created_at):'Example only')),shareBtn,detail);
  card.append(top,element('h3','',x.title));
  if(x.employer)card.append(element('p','publisher-line',x.employer));
  card.append(element('p','card-description',x.body));if(x.contact){const c=contactActions(x.contact,x);if(c)card.append(c)}card.append(bottom);
  const summary=listingSummary(x);
  if(summary){
   const badge=boatStatusBadge(x);
   const highlightCls='listing-highlight '+(x.details?.boatStatus||'')+(badge?' status-'+badge.cls:'');
   card.insertBefore(element('p',highlightCls,summary),card.querySelector('p'));
  }
  if(x.category==='Boats'&&x.details?.cargoAccepted){
   const cargoText='📦 Cargo: '+(x.details.cargoStatus==='limited'?'Limited space':'Accepted')+(x.details.cargoRate?' ('+x.details.cargoRate+')':'');
   card.insertBefore(element('p','cargo-badge',cargoText),card.querySelector('p'));
  }
  const photo=listingPhoto(x);
  if(photo)card.insertBefore(photo,bottom);
  const rate=ratingFor(x),shown=rate.op||rate.own;
  if(shown)card.insertBefore(element('p','rating-line','⭐ '+shown.avg.toFixed(1)+' · '+shown.count+(shown.count===1?' rating':' ratings')+(rate.op?' for this operator':'')),bottom);
  return card;
 }));
 if(!rows.length)$('#feed').append(element('p','empty','No listings here yet. Try another island, clear your search, or be the first to share something with your community.'));
 updateSyncedTime();renderIslandMap();
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

function contactActions(contact,item){
 if(!contact||typeof contact!=='string')return null;
 const digits=contact.replace(/[^0-9]/g,'');
 let phone=null;
 if(digits.length>=7&&digits.length<=12){
  phone=digits.startsWith('686')?digits:('686'+digits.replace(/^0+/,''));
 }
 const emailMatch=contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
 const wrap=element('div','card-contact-actions');
 let msg='Mauri!';
 if(item){
  if(item.category==='Boats'){
   const dest=item.details?.destinationIsland?(' ('+item.island+' → '+item.details.destinationIsland+')'):'';
   msg=`Mauri! I saw your boat schedule${dest} on Kiribati Connect. Are there seats available?`;
  }else if(item.category==='Jobs'){
   msg=`Mauri! I saw your job vacancy for "${item.title}" on Kiribati Connect and would like to ask about applying.`;
  }else if(item.category==='Marketplace'){
   const pr=item.details?.price!=null?` (${item.details.currency||'AUD'} $${Number(item.details.price).toFixed(2)})`:'';
   msg=`Mauri! Is "${item.title}"${pr} listed on Kiribati Connect still available?`;
  }else{
   msg=`Mauri! I am inquiring about your Kiribati Connect notice "${item.title}".`;
  }
 }
 if(phone){
  const wa=element('a','contact-btn wa-btn','💬 WhatsApp');
  wa.href='https://wa.me/'+phone+'?text='+encodeURIComponent(msg);
  wa.target='_blank';wa.rel='noopener noreferrer';
  const call=element('a','contact-btn call-btn','📞 Call');
  call.href='tel:+'+phone;
  const sms=element('a','contact-btn sms-btn','✉️ SMS');
  sms.href='sms:+'+phone+'?body='+encodeURIComponent(msg);
  wrap.append(wa,call,sms);
 }
 if(emailMatch){
  const mail=element('a','contact-btn mail-btn','✉️ Email');
  const subj=encodeURIComponent('Kiribati Connect: '+(item?.title||'Inquiry'));
  mail.href='mailto:'+emailMatch[0]+'?subject='+subj+'&body='+encodeURIComponent(msg);
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

function estimateTarawaTide(date=new Date()){
 const refEpoch=1767241800000;
 const cycleMs=12.4206*3600*1000;
 const diff=date.getTime()-refEpoch;
 const phase=((diff%cycleMs)+cycleMs)%cycleMs;
 const timeToNextHigh=cycleMs-phase;
 const timeToNextLow=phase<cycleMs/2?(cycleMs/2-phase):(cycleMs*1.5-phase);
 const nextHigh=new Date(date.getTime()+timeToNextHigh);
 const nextLow=new Date(date.getTime()+timeToNextLow);
 const fmt=d=>d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Pacific/Tarawa'});
 const isRising=phase>cycleMs/2;
 return {state:isRising?'🌊 Rising tide':'📉 Falling tide',high:fmt(nextHigh),low:fmt(nextLow)};
}

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
  const tide=estimateTarawaTide();
  title.textContent=loc.label+' · '+temp+'°C';
  info.textContent='Wind: '+wind+' km/h · '+condition;
  meta.textContent=tide.state+' · Next High: '+tide.high+' · Next Low: '+tide.low+' (Tarawa time)';
 }catch{}
}

let currentLightbox=null;
function openLightbox(images,startIndex=0,title=''){
 if(!images||!images.length)return;
 let idx=startIndex;
 const overlay=element('div','kc-lightbox');
 overlay.setAttribute('role','dialog');
 overlay.setAttribute('aria-label',title||'Photo preview');
 const closeBtn=element('button','kc-lightbox-close','×');
 closeBtn.setAttribute('aria-label','Close photo');
 const img=element('img','kc-lightbox-img');
 img.src=images[idx];img.alt=title;
 const caption=element('div','kc-lightbox-caption',(title?title+' · ':'')+(idx+1)+'/'+images.length);
 const update=()=>{img.src=images[idx];caption.textContent=(title?title+' · ':'')+(idx+1)+'/'+images.length;};
 const prevBtn=element('button','kc-lightbox-prev','‹');
 prevBtn.setAttribute('aria-label','Previous photo');
 prevBtn.onclick=e=>{e.stopPropagation();idx=(idx-1+images.length)%images.length;update();};
 const nextBtn=element('button','kc-lightbox-next','›');
 nextBtn.setAttribute('aria-label','Next photo');
 nextBtn.onclick=e=>{e.stopPropagation();idx=(idx+1)%images.length;update();};
 const close=()=>{overlay.remove();window.removeEventListener('keydown',onKey);currentLightbox=null;};
 const onKey=e=>{
  if(e.key==='Escape')close();
  if(e.key==='ArrowLeft'){idx=(idx-1+images.length)%images.length;update();}
  if(e.key==='ArrowRight'){idx=(idx+1)%images.length;update();}
 };
 closeBtn.onclick=close;
 overlay.onclick=e=>{if(e.target===overlay)close();};
 window.addEventListener('keydown',onKey);
 overlay.append(closeBtn,img,caption);
 if(images.length>1)overlay.append(prevBtn,nextBtn);
 document.body.append(overlay);
 currentLightbox=overlay;
}

function listingPhoto(item){
 const images=(item.images&&item.images.length)?item.images:(item.category==='Marketplace'&&item.details?.photoUrl?[item.details.photoUrl]:[]);
 if(!images.length)return null;
 const container=element('div','listing-photo-container');
 let curIdx=0;
 const build=()=>{
  const photo=element('img','listing-photo');
  photo.src=images[curIdx];photo.alt=item.title;photo.loading='lazy';photo.decoding='async';photo.referrerPolicy='no-referrer';
  photo.onclick=()=>openLightbox(images,curIdx,item.title);photo.style.cursor='zoom-in';
  if(images.length>1){
   const badge=element('span','photo-counter',(curIdx+1)+'/'+images.length+' 🔍');
   badge.onclick=e=>{e.stopPropagation();openLightbox(images,curIdx,item.title);};
   const prev=element('button','carousel-btn prev-btn','‹');prev.type='button';
   prev.onclick=e=>{e.stopPropagation();curIdx=(curIdx-1+images.length)%images.length;photo.src=images[curIdx];badge.textContent=(curIdx+1)+'/'+images.length+' 🔍';};
   const next=element('button','carousel-btn next-btn','›');next.type='button';
   next.onclick=e=>{e.stopPropagation();curIdx=(curIdx+1)%images.length;photo.src=images[curIdx];badge.textContent=(curIdx+1)+'/'+images.length+' 🔍';};
   container.replaceChildren(prev,photo,next,badge);
  }else{
   container.replaceChildren(photo);
  }
  return container;
 };
 if(!dataSaver)return build();
 const holder=element('button','secondary photo-saver','🖼 Tap to load photo'+(images.length>1?' ('+images.length+' photos)':'')+' (saves data)');
 holder.type='button';holder.onclick=()=>holder.replaceWith(build());return holder;
}

function listingSourceLink(item){return null}

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
  const depTime=details.departureUtc?new Date(details.departureUtc):new Date();
  const tide=estimateTarawaTide(depTime);
  return badgePrefix+(details.boatStatus||'scheduled').toUpperCase()+' · '+item.island+' → '+details.destinationIsland+' · '+details.departureLocal?.replace('T',' ')+' (UTC+'+details.utcOffset+') · '+tide.state;
 }
 if(item.category==='Marketplace')return details.currency+' '+Number(details.price).toFixed(2)+' · '+details.availability;
 return '';
}

function listingDate(value){if(!value||!Number.isFinite(Date.parse(value)))return 'Community listing';return 'Updated '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Pacific/Tarawa'}).format(new Date(value))}

const alertsDialog=$('#alerts-dialog');
if(alertsDialog){
 $('#alerts').onclick=()=>{alertsDialog.showModal();const p=read('kc-alert-prefs',{});if(p.email)$('#alert-email').value=p.email;if(p.boats!=null)$('#alert-boats').checked=p.boats;if(p.jobs!=null)$('#alert-jobs').checked=p.jobs;if(p.digest!=null)$('#alert-digest').checked=p.digest;};
 $('#close-alerts').onclick=()=>alertsDialog.close();
 $('#alerts-form').onsubmit=async event=>{
  event.preventDefault();
  const email=$('#alert-email').value.trim();
  const prefs={email,boats:$('#alert-boats').checked,jobs:$('#alert-jobs').checked,digest:$('#alert-digest').checked,island:$('#island')?.value||'All islands'};
  try{localStorage.setItem('kc-alert-prefs',JSON.stringify(prefs))}catch{}
  const statusEl=$('#alerts-status');
  if(statusEl)statusEl.textContent='Saving preferences…';
  try{
   const res=await fetch('/api/alerts/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(prefs)});
   const data=await res.json();
   if(!res.ok)throw Error(data.error||'Failed to save.');
   toast('Subscribed to '+prefs.island+' updates & weekly digest!');
   alertsDialog.close();
  }catch(err){
   toast('Preferences saved on device ('+err.message+').');
   alertsDialog.close();
  }finally{if(statusEl)statusEl.textContent='';}
 };
}

if(typeof navigator!=='undefined'&&navigator.userAgent?.includes('Android')&&!navigator.userAgent?.includes('KiribatiConnectAndroid')&&!$('#android-banner')){
 const hero=$('.hero>div:first-child');
 if(hero){
  const banner=element('div','android-install-banner');
  banner.id='android-banner';
  banner.innerHTML='⚡ <b>Android App</b>: Faster offline feed & home screen widget. <a href="/download/kiribati-connect.apk" class="install-apk-link">Download APK (v1.2.0) ↓</a>';
  hero.append(banner);
 }
}

const mapIslands=[
 {name:'Makin',x:50,y:35},
 {name:'Butaritari',x:75,y:60},
 {name:'Marakei',x:110,y:90},
 {name:'Abaiang',x:125,y:120},
 {name:'North Tarawa',x:145,y:140},
 {name:'South Tarawa',x:140,y:165,hub:true},
 {name:'Maiana',x:155,y:200},
 {name:'Kuria',x:145,y:235},
 {name:'Aranuka',x:180,y:245},
 {name:'Abemama',x:205,y:220},
 {name:'Nonouti',x:235,y:260},
 {name:'Tabiteuea',x:265,y:290},
 {name:'Beru',x:300,y:275},
 {name:'Nikunau',x:335,y:260},
 {name:'Onotoa',x:295,y:310},
 {name:'Tamana',x:275,y:335},
 {name:'Arorae',x:310,y:350},
 {name:'Kiritimati',x:420,y:80},
 {name:'Tabuaeran',x:420,y:125},
 {name:'Kanton',x:420,y:220}
];

function renderIslandMap(){
 const container=$('#island-map-container');
 if(!container)return;
 const currentSelected=$('#island')?.value||'All islands';
 const activeRoutes=[];
 for(const it of notices){
  if(it.category==='Boats'&&it.details?.destinationIsland){
   const from=mapIslands.find(m=>m.name===it.island);
   const to=mapIslands.find(m=>m.name===it.details.destinationIsland);
   if(from&&to)activeRoutes.push({from,to,status:it.details.boatStatus||'scheduled'});
  }
 }
 let svg='<svg viewBox="0 0 490 380" class="atoll-map-svg" role="img" aria-label="Interactive Kiribati Island Map"><defs><radialGradient id="lagoon-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#99d6c7" stop-opacity="0.6"/><stop offset="100%" stop-color="#08665d" stop-opacity="0.1"/></radialGradient></defs><rect width="100%" height="100%" rx="14" fill="#f1f7f4"/><rect x="365" y="15" width="115" height="350" rx="10" fill="#eaf2ee" stroke="#cfe0d7" stroke-dasharray="4,4"/><text x="422" y="32" text-anchor="middle" font-size="9" font-weight="700" fill="#526f65">LINE & PHOENIX</text><text x="35" y="24" font-size="10" font-weight="700" fill="#526f65">GILBERT GROUP (TUNGARU)</text>';
 for(const r of activeRoutes){
  const mx=(r.from.x+r.to.x)/2+(r.from.y-r.to.y)*0.15,my=(r.from.y+r.to.y)/2+(r.to.x-r.from.x)*0.15;
  const strokeColor=r.status==='delayed'?'#d97706':r.status==='cancelled'?'#dc2626':'#08665d';
  svg+='<path d="M '+r.from.x+' '+r.from.y+' Q '+mx+' '+my+' '+r.to.x+' '+r.to.y+'" class="active-route-line" stroke="'+strokeColor+'" stroke-dasharray="5,4" fill="none" stroke-width="2.2" opacity="0.85"/>';
 }
 for(const m of mapIslands){
  const isSelected=currentSelected===m.name;
  const count=notices.filter(n=>n.island===m.name||n.details?.destinationIsland===m.name).length;
  const dotR=m.hub?8:(count?6:4.5);
  const dotFill=isSelected?'#d97706':(m.hub?'#08665d':(count?'#107d70':'#739589'));
  const textFill=isSelected?'#b45309':(m.hub?'#08665d':'#2b473f');
  const fontWeight=isSelected||m.hub?'bold':'normal';
  const labelY=m.y+(m.x>380?12:-7);
  const textAnchor=m.x>380?'middle':(m.x<100?'start':'middle');
  svg+='<g class="map-island-node" data-island="'+m.name+'" style="cursor:pointer;" onclick="selectIslandFromMap(\''+m.name+'\')">'+(m.hub?'<circle cx="'+m.x+'" cy="'+m.y+'" r="15" fill="url(#lagoon-grad)"/>':'')+(isSelected?'<circle cx="'+m.x+'" cy="'+m.y+'" r="'+(dotR+5)+'" fill="none" stroke="#d97706" stroke-width="2" class="selected-pulse"/>':'')+'<circle cx="'+m.x+'" cy="'+m.y+'" r="'+dotR+'" fill="'+dotFill+'" stroke="#ffffff" stroke-width="1.5" class="atoll-circle"/><text x="'+m.x+'" y="'+labelY+'" font-size="'+(m.hub?11:9)+'" font-weight="'+fontWeight+'" fill="'+textFill+'" text-anchor="'+textAnchor+'">'+m.name+(count?' ('+count+')':'')+'</text></g>';
 }
 svg+='</svg>';
 container.innerHTML=svg;
}

window.selectIslandFromMap=function(islandName){
 const select=$('#island');
 if(select){
  select.value=islandName;
  updatePinBtn();updateWeather(islandName);render();
  $('#feed-section')?.scrollIntoView({behavior:'smooth'});
 }
};

function openShareModal(item){
 const dlg=$('#share-dialog');
 if(!dlg)return;
 const url=item.showcaseUrl?new URL(item.showcaseUrl,location.origin).href:location.href;
 $('#share-title').textContent=item.title;
 $('#share-subtitle').textContent=(item.employer?item.employer+' · ':'')+item.island+' · '+item.category;
 const fb=$('#share-fb');
 if(fb)fb.href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url);
 const wa=$('#share-wa');
 if(wa)wa.href='https://wa.me/?text='+encodeURIComponent(item.title+' ('+item.island+') on Kiribati Connect:\n'+url);
 const copyBtn=$('#share-copy');
 if(copyBtn)copyBtn.onclick=async()=>{try{if(navigator.clipboard)await navigator.clipboard.writeText(url);toast('Listing link copied to clipboard!');}catch{toast('Link: '+url);}};
 const printBtn=$('#share-print');
 if(printBtn)printBtn.onclick=()=>{
  const w=window.open('','_blank');
  if(!w)return toast('Please allow popups to print notice card.');
  const qrSvg=$('#share-qr-box svg')?.outerHTML||'';
  w.document.write('<!doctype html><html><head><title>'+item.title+' - Kiribati Connect</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:30px;text-align:center;color:#163f3a;max-width:480px;margin:0 auto;border:2px dashed #08665d;border-radius:16px;}h1{font-size:24px;margin:12px 0 6px;}.meta{color:#526f65;font-size:14px;margin-bottom:18px;}.desc{font-size:15px;line-height:1.5;margin-bottom:20px;text-align:left;padding:12px;background:#f7f7ef;border-radius:8px;}.qr{margin:20px auto;max-width:200px;}.qr svg{width:100%;height:auto;}.brand{font-size:16px;font-weight:bold;color:#08665d;}@media print{button{display:none;}}</style></head><body><div class="brand">Kiribati Connect</div><h1>'+item.title+'</h1><div class="meta">'+item.category+' · '+item.island+(item.employer?' · '+item.employer:'')+'</div><div class="desc">'+item.body+'</div><div class="qr">'+qrSvg+'</div><p style="font-size:13px;color:#555;">Scan with your phone to view updates, details and operator contact.</p><button onclick="window.print()" style="padding:10px 18px;font-size:15px;cursor:pointer;background:#08665d;color:#fff;border:0;border-radius:8px;margin-top:10px;">Print Notice</button></body></html>');
  w.document.close();
 };
 const box=$('#share-qr-box');
 if(box){
  box.innerHTML='';
  try{
   if(typeof qrcode==='function'){
    const qr=qrcode(0,'M');
    qr.addData(url);
    qr.make();
    box.innerHTML=qr.createSvgTag(5);
   }
  }catch{}
 }
 dlg.showModal();
}
const closeShare=$('#close-share');
if(closeShare)closeShare.onclick=()=>$('#share-dialog')?.close();
