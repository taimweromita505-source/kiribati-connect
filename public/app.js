const $=s=>document.querySelector(s);const categories=['All updates','Boats','Ships','Flights','Jobs','Community','Marketplace'];const icons=['⌂','⛵','🚢','✈️','💼','☷','▧'];let view='All updates',savedOnly=false;function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}let saved=read('kc-saved',[]),notices=read('kc-approved-v5',[]);function persist(){try{localStorage.setItem('kc-saved',JSON.stringify(saved));localStorage.setItem('kc-notices',JSON.stringify(notices))}catch{toast('Device storage is unavailable. Changes last for this session.')}}
const samples=[{id:'c1',category:'Community',title:'A cleaner shore starts with us',body:'Join a community beach clean-up and help keep our lagoon beautiful. Bring a reusable bottle and a friend.',island:'South Tarawa',source:'Community board · Sample',detail:'Example notice only. A real event would include an organiser, verified date, meeting point, and contact details.'},{id:'j1',category:'Jobs',title:'Community outreach assistant',body:'A sample opportunity for someone who enjoys working with people and supporting local projects.',island:'South Tarawa',source:'Job board · Sample',detail:'Example vacancy only; no employer or open position is represented. Real listings need an employer, closing date, pay details, and an application contact.'},{id:'b1',category:'Boats',title:'Tarawa → Abaiang',body:'Sample departure · 7:00 AM · Passenger service. A simple place to find your next island connection.',island:'Abaiang',source:'Boat schedules · Unverified sample',detail:'No actual sailing is confirmed. Before travelling, verify departure date, port, fares, availability, weather, and last-minute changes directly with the operator.'},{id:'s1',category:'Ships',title:'KSSL MV Moamoa · Central & Southern Atolls Voyage',body:'Inter-island voyage · Betio Port (Tarawa) → Abemama, Nonouti, Tabiteuea. Passenger cabins, deck passage, and container/loose cargo bookings open at Betio Wharf.',island:'South Tarawa',source:'Ship voyage · Sample',employer:'Kiribati Shipping Services Ltd',detail:'Sample shipping voyage. Verify freight loading cut-offs, container bookings, and boarding tickets directly with KSSL Betio Wharf office.'},{id:'f1',category:'Flights',title:'Air Kiribati · Bonriki (Tarawa) → Cassidy (Kiritimati)',body:'Scheduled domestic air service · Bonriki International Airport → Cassidy Airport. 15 kg checked luggage allowance + 5 kg carry-on.',island:'South Tarawa',source:'Flight schedule · Sample',employer:'Air Kiribati',detail:'Sample flight connection. Check-in counters close 45 minutes prior to departure. Confirm bookings and baggage limits with Air Kiribati.'},{id:'m1',category:'Marketplace',title:'Locally made woven baskets',body:'A preview of a local marketplace: handmade goods, useful finds, and connections close to home.',island:'North Tarawa',source:'Marketplace · Sample',detail:'Example listing only. There is no item for sale or seller to contact in this prototype.'},{id:'b2',category:'Boats',title:'Tarawa → Maiana',body:'Sample departure · 9:30 AM · Check the latest operator update before heading to the wharf.',island:'Maiana',source:'Boat schedules · Unverified sample',detail:'Illustrative schedule only. No departure date or real operator is connected.'},{id:'c2',category:'Community',title:'A space for Kiritimati community news',body:'Share local events, practical updates, and opportunities from your island.',island:'Kiritimati',source:'Community board · Sample',detail:'Example only. Sign in and choose Create a listing to save your own private draft.'}];
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
 if(!['Boats','Ships','Flights'].includes(item.category))return null;
 const details=item.details||{},status=details.flightStatus||details.shipStatus||details.boatStatus||'scheduled';
 const refDate=item.confirmed_at||item.updated_at||item.created_at;
 const ageDays=refDate?(Date.now()-Date.parse(refDate))/86400000:999;
 const depDate=details.departureLocal?Date.parse(details.departureLocal):null;
 if(status==='cancelled'||(depDate&&depDate<Date.now())||ageDays>7){
  return {cls:'outdated',text:'🔴 Outdated (>7d)'};
 }
 if(details.boatConfirmed||details.shipConfirmed||details.flightConfirmed||item.source_verified){
  return {cls:'verified',text:'🟢 Verified'};
 }
 return {cls:'community-checked',text:'🟡 Community-checked'};
}


function getIslandTimezone(islandName){
 const lineIslands=['Kiritimati','Tabuaeran','Teraina','Malden','Starbuck','Vostok','Flint','Millennium'];
 const phoenixIslands=['Kanton','Birnie','Enderbury','Manra','McKean','Nikumaroro','Orona','Rawaki'];
 if(islandName&&lineIslands.some(x=>islandName.includes(x))){
  return {tz:'Pacific/Kiritimati',offset:14,group:'Line Islands',label:'Line Is. (UTC+14)'};
 }
 if(islandName&&phoenixIslands.some(x=>islandName.includes(x))){
  return {tz:'Pacific/Kanton',offset:13,group:'Phoenix Islands',label:'Phoenix (UTC+13)'};
 }
 return {tz:'Pacific/Tarawa',offset:12,group:'Gilbert Group',label:'Gilbert (UTC+12)'};
}

function formatDepartureCountdown(depUtc,status){
 if(status==='closed'||status==='departed')return {text:'⛵ Departed / In Transit',cls:'countdown-departed'};
 if(status==='cancelled')return {text:'⚠️ Cancelled',cls:'countdown-cancelled'};
 if(!depUtc)return null;
 const diffMs=Date.parse(depUtc)-Date.now();
 if(!Number.isFinite(diffMs))return null;
 if(diffMs<=0)return {text:'⚠️ Past scheduled departure time',cls:'countdown-past'};
 const diffSec=Math.floor(diffMs/1000);
 const diffMin=Math.floor(diffSec/60);
 const diffHr=Math.floor(diffMin/60);
 const diffDay=Math.floor(diffHr/24);

 if(diffMin<60){
  const mins=Math.max(1,diffMin);
  return {text:'⏳ Departs in '+mins+'m (Boarding soon!)',cls:'countdown-urgent'};
 }
 if(diffHr<24){
  const remMins=diffMin%60;
  return {text:'⏳ Departs in '+diffHr+'h '+remMins+'m',cls:'countdown-soon'};
 }
 if(diffDay<7){
  const remHours=diffHr%24;
  return {text:'⏳ Departs in '+diffDay+'d '+remHours+'h',cls:'countdown-scheduled'};
 }
 return {text:'⏳ Departs in '+diffDay+' days',cls:'countdown-scheduled'};
}

function updateKiribatiClock(){
 const now=new Date();
 const selectedIsland=$('#island')?.value||'All islands';
 const activeTz=getIslandTimezone(selectedIsland);

 const fmtTime=(tz)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
 const fmtShortTime=(tz)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
 const fmtDate=(tz)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'short',day:'numeric',month:'short'}).format(now);
 const fmtLongDate=(tz)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);

 const tarawaTime=fmtTime('Pacific/Tarawa');
 const kantonTime=fmtTime('Pacific/Kanton');
 const kiritimatiTime=fmtTime('Pacific/Kiritimati');
 const tarawaShort=fmtShortTime('Pacific/Tarawa');
 const kantonShort=fmtShortTime('Pacific/Kanton');
 const kiritimatiShort=fmtShortTime('Pacific/Kiritimati');

 // Top ticker
 const tickerPrimary=$('#ticker-primary-time');
 if(tickerPrimary)tickerPrimary.textContent=selectedIsland==='All islands'?tarawaTime:fmtTime(activeTz.tz);
 const tickerIsland=$('#ticker-active-island');
 if(tickerIsland)tickerIsland.textContent=selectedIsland==='All islands'?'Tarawa (UTC+12)':selectedIsland+' (UTC+'+activeTz.offset+')';
 const tTarawa=$('#ticker-tarawa-time');if(tTarawa)tTarawa.textContent=tarawaShort;
 const tKanton=$('#ticker-kanton-time');if(tKanton)tKanton.textContent=kantonShort;
 const tKiritimati=$('#ticker-kiritimati-time');if(tKiritimati)tKiritimati.textContent=kiritimatiShort;

 // Rail card
 const railDisplay=$('#rail-clock-display');
 if(railDisplay)railDisplay.textContent=selectedIsland==='All islands'?tarawaTime:fmtTime(activeTz.tz);
 const railDate=$('#rail-clock-date');
 if(railDate)railDate.textContent=fmtLongDate(selectedIsland==='All islands'?'Pacific/Tarawa':activeTz.tz);
 const rzGilbert=$('#rz-gilbert-time');if(rzGilbert)rzGilbert.textContent=tarawaTime;
 const rzPhoenix=$('#rz-phoenix-time');if(rzPhoenix)rzPhoenix.textContent=kantonTime;
 const rzLine=$('#rz-line-time');if(rzLine)rzLine.textContent=kiritimatiTime;

 // Hero clock
 const heroText=$('#hero-clock-text');
 if(heroText){
  if(selectedIsland==='All islands'){
   heroText.textContent='Kiribati Real Time: Tarawa '+tarawaShort+' (UTC+12) · Kiritimati '+kiritimatiShort+' (UTC+14)';
  }else{
   heroText.textContent=selectedIsland+': '+fmtTime(activeTz.tz)+' (UTC+'+activeTz.offset+')';
  }
 }

 // Header clock badge
 const clockDisplay=$('#clock-display');
 if(clockDisplay){
  if(selectedIsland==='All islands'){
   clockDisplay.textContent='Tarawa '+tarawaTime+' (UTC+12) · Kiritimati '+kiritimatiTime+' (UTC+14)';
  }else{
   const islandShort=selectedIsland.length>14?selectedIsland.slice(0,12)+'…':selectedIsland;
   const activeTime=fmtTime(activeTz.tz);
   clockDisplay.textContent=islandShort+' '+activeTime+' (UTC+'+activeTz.offset+')';
  }
 }

 // Aside sidebar clock card
 const asidePrimary=$('#aside-clock-primary');
 if(asidePrimary){
  const activeTime=selectedIsland==='All islands'?tarawaTime:fmtTime(activeTz.tz);
  const activeDate=selectedIsland==='All islands'?fmtDate('Pacific/Tarawa'):fmtDate(activeTz.tz);
  asidePrimary.textContent=activeTime;
  const asideDate=$('#aside-clock-date');
  if(asideDate)asideDate.textContent=activeDate+' · '+(selectedIsland==='All islands'?'Tarawa Standard':selectedIsland);
  const asideZoneBadge=$('#aside-clock-active-zone');
  if(asideZoneBadge)asideZoneBadge.textContent='UTC+'+(selectedIsland==='All islands'?'12':activeTz.offset);

  const szTarawa=$('#sz-tarawa');if(szTarawa)szTarawa.textContent=tarawaShort;
  const szKanton=$('#sz-kanton');if(szKanton)szKanton.textContent=kantonShort;
  const szKiritimati=$('#sz-kiritimati');if(szKiritimati)szKiritimati.textContent=kiritimatiShort;
 }
}
window.updateKiribatiClock=updateKiribatiClock;

function render(){
 $('#nav').replaceChildren(...categories.map((c,i)=>{let b=element('button',view===c?'active':'');b.append(element('span','',icons[i]),document.createTextNode(c==='All updates'?'Home':c==='Boats'?'Boats':c==='Ships'?'Ship voyages':c==='Flights'?'Flights':c));b.onclick=()=>choose(c);b.setAttribute('aria-pressed',view===c);return b}));
 $('#filters').replaceChildren(...categories.map(c=>{let b=element('button',view===c?'active':'',c);b.onclick=()=>choose(c);b.setAttribute('aria-pressed',view===c);return b}));
 $('#heading').textContent=savedOnly?'Your saved updates':view==='All updates'?'The latest in your community':view==='Boats'?'Find your next lagoon crossing':view==='Ships'?'Inter-island shipping & cargo voyages':view==='Flights'?'Domestic & regional flight schedules':view==='Jobs'?'Opportunities close to home':view+' updates';
 let q=$('#search').value.toLowerCase(),island=$('#island').value;
 const pFilter=$('#price-filter')?.value||'all';
 let rows=[...notices,...($('#show-examples')?.checked?samples:[])].filter(x=>(!x.expires_at||Date.parse(x.expires_at)>Date.now())&&(view==='All updates'||x.category===view)&&matchesListingIsland(x,island)&&(!savedOnly||saved.includes(x.id))&&[x.title,x.body,x.island,x.employer||'',JSON.stringify(x.details||{})].join(' ').toLowerCase().includes(q));
 if(pFilter==='wanted'){
  rows=rows.filter(x=>x.category==='Marketplace'&&x.details?.intent==='wanted');
 }else if(pFilter==='under20'){
  rows=rows.filter(x=>x.details?.price!=null&&Number(x.details.price)<20);
 }else if(pFilter==='20-100'){
  rows=rows.filter(x=>x.details?.price!=null&&Number(x.details.price)>=20&&Number(x.details.price)<=100);
 }else if(pFilter==='over100'){
  rows=rows.filter(x=>x.details?.price!=null&&Number(x.details.price)>100);
 }
 if(reliableOnly)rows=rows.filter(x=>{const r=ratingFor(x);return (r.op||r.own)?.avg>=4}).sort((a,b)=>{const ra=ratingFor(a),rb=ratingFor(b);return (rb.op||rb.own).avg-(ra.op||ra.own).avg});
 $('#feed-count').textContent=rows.length+' '+(rows.length===1?'listing':'listings')+(island==='All islands'?' across the islands':' in '+island);
 $('#feed').replaceChildren(...rows.map(x=>{
  let card=element('article','card'),top=element('div','card-top'),save=element('button','save',saved.includes(x.id)?'♥':'♡');
  save.setAttribute('aria-label',(saved.includes(x.id)?'Unsave ':'Save ')+x.title);
  save.onclick=()=>{saved=saved.includes(x.id)?saved.filter(id=>id!==x.id):[...saved,x.id];persist();render()};
  let tagText=x.category;
  if(x.status==='closed')tagText+=(x.category==='Boats'?' · DEPARTED ⛵':x.category==='Ships'?' · DEPARTED 🚢':x.category==='Flights'?' · DEPARTED ✈️':x.category==='Jobs'?' · FILLED ✓':' · SOLD 🏷️');
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
  if(['Boats','Ships','Flights'].includes(x.category)&&x.details?.destinationIsland){
   const est=routeEstimateText(x.island,x.details.destinationIsland,x.category);
   if(est)card.insertBefore(element('p','route-distance-badge',est),card.querySelector('p'));
   if(x.details.viaIslands)card.insertBefore(element('p','via-stops-badge','⚓ Via: '+x.details.viaIslands),card.querySelector('p'));
   if(x.details.returnDepartureLocal)card.insertBefore(element('p','return-trip-badge','⇄ Return: '+x.details.returnDepartureLocal.replace('T',' ')),card.querySelector('p'));
   if(['Boats','Ships','Flights'].includes(x.category)){
    const depUtc=x.details?.departureUtc||(x.details?.departureLocal?(new Date(Date.parse(x.details.departureLocal+':00.000Z')-(x.details.utcOffset||12)*3600000).toISOString()):null);
    const countdown=formatDepartureCountdown(depUtc,x.status==='closed'?'departed':(x.details?.flightStatus||x.details?.shipStatus||x.details?.boatStatus));
    if(countdown)card.insertBefore(element('p','departure-countdown-badge '+countdown.cls,countdown.text),card.querySelector('p'));
   }
  }
  if(x.category==='Marketplace'&&x.details?.intent==='wanted'){
   top.prepend(element('span','tag-wanted','🔍 WANTED'));
  }
  if(['Boats','Ships','Flights'].includes(x.category)&&x.details?.cargoAccepted){
   const cargoText=(x.category==='Flights'?'✈️ Air freight: ':'📦 Cargo: ')+(x.details.cargoStatus==='limited'?'Limited space':'Accepted')+(x.details.cargoRate?' ('+x.details.cargoRate+')':'');
   card.insertBefore(element('p','cargo-badge',cargoText),card.querySelector('p'));
  }
  if(x.category==='Flights'&&x.details?.flightNumber){
   card.insertBefore(element('p','flight-badge','✈️ Flight '+x.details.flightNumber+(x.details.baggageAllowance?' · Baggage: '+x.details.baggageAllowance:'')),card.querySelector('p'));
  }
  if(x.category==='Ships'&&x.details?.vesselName){
   card.insertBefore(element('p','ship-badge','🚢 Vessel: '+x.details.vesselName),card.querySelector('p'));
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
const priceFilterSelect=$('#price-filter');if(priceFilterSelect)priceFilterSelect.onchange=render;
const printBulletinBtn=$('#print-bulletin-btn');if(printBulletinBtn)printBulletinBtn.onclick=openPrintBulletin;
$('#island').onchange=()=>{updatePinBtn();updateWeather($('#island').value);updateKiribatiClock();render();};
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
render();updateWeather($('#island')?.value||'South Tarawa');updateKiribatiClock();setInterval(updateKiribatiClock,1000);
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
  }else if(item.category==='Ships'){
   const dest=item.details?.destinationIsland?(' ('+item.island+' → '+item.details.destinationIsland+')'):'';
   msg=`Mauri! I saw your ship voyage${dest} on Kiribati Connect. I would like to ask about passenger tickets and cargo space.`;
  }else if(item.category==='Flights'){
   const dest=item.details?.destinationIsland?(' ('+item.island+' → '+item.details.destinationIsland+')'):'';
   const fl=item.details?.flightNumber?(' Flight '+item.details.flightNumber):'';
   msg=`Mauri! I saw your scheduled flight${fl}${dest} on Kiribati Connect. Are seats available to book?`;
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
  const temp=Math.round(cur.temperature_2m),windKm=Math.round(cur.wind_speed_10m);
  const windKts=Math.round(windKm * 0.539957);
  const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const windDir=dirs[Math.round((cur.wind_direction_10m||0)/22.5)%16];
  const seaState=windKts<10?'🟢 CALM LAGOON (Smooth crossings · Swell <0.8m)':windKts<16?'🟢 MODERATE BREEZE (Good crossings · Light chop 0.8-1.2m)':windKts<22?'🟡 CHOPPY WATERS (Caution for small craft · Swell 1.3-1.8m)':'🔴 ROUGH SEAS & STRONG WINDS (Advisory: check with harbour master)';
  const tide=estimateTarawaTide();
  title.textContent=loc.label+' · '+temp+'°C · '+windKts+' kts '+windDir;
  info.textContent=seaState;
  meta.textContent='Marine Barometer · '+tide.state+' · Next High: '+tide.high+' · Next Low: '+tide.low+' (Tarawa time)';
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
 if(['Boats','Ships','Flights'].includes(item.category)){
  const badge=boatStatusBadge(item);
  const badgePrefix=badge?badge.text+' · ':'';
  const depTime=details.departureUtc?new Date(details.departureUtc):new Date();
  const tideInfo=item.category!=='Flights'?(' · '+estimateTarawaTide(depTime).state):'';
  const status=(details.flightStatus||details.shipStatus||details.boatStatus||'scheduled').toUpperCase();
  const flightNo=item.category==='Flights'&&details.flightNumber?(' [Flight '+details.flightNumber+'] '):'';
  return badgePrefix+status+flightNo+' · '+item.island+' → '+details.destinationIsland+' · '+details.departureLocal?.replace('T',' ')+' (UTC+'+details.utcOffset+')'+tideInfo;
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
  banner.innerHTML='⚡ <b>Android App</b>: Faster offline feed & home screen widget. <a href="/download/kiribati-connect.apk" class="install-apk-link">Download APK (v1.5.0) ↓</a>';
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


const atollCoords = {
 'Makin':{lat:3.38,lon:172.98},
 'Butaritari':{lat:3.15,lon:172.82},
 'Marakei':{lat:2.00,lon:173.28},
 'Abaiang':{lat:1.83,lon:172.95},
 'Tarawa':{lat:1.35,lon:173.00},
 'North Tarawa':{lat:1.50,lon:173.02},
 'South Tarawa':{lat:1.33,lon:172.98},
 'Betio':{lat:1.35,lon:172.93},
 'Maiana':{lat:0.92,lon:173.01},
 'Abemama':{lat:0.40,lon:173.86},
 'Kuria':{lat:0.22,lon:173.41},
 'Aranuka':{lat:0.16,lon:173.60},
 'Nonouti':{lat:-0.67,lon:174.35},
 'Tabiteuea':{lat:-1.33,lon:174.83},
 'North Tabiteuea':{lat:-1.15,lon:174.68},
 'South Tabiteuea':{lat:-1.48,lon:175.02},
 'Beru':{lat:-1.33,lon:175.98},
 'Nikunau':{lat:-1.37,lon:176.47},
 'Onotoa':{lat:-1.88,lon:175.55},
 'Tamana':{lat:-2.50,lon:175.98},
 'Arorae':{lat:-2.64,lon:176.82},
 'Banaba':{lat:-0.85,lon:169.53},
 'Kanton':{lat:-2.81,lon:-171.67},
 'Kiritimati':{lat:1.87,lon:-157.40},
 'Tabuaeran':{lat:3.88,lon:-159.33},
 'Teraina':{lat:4.68,lon:-160.38}
};

function atollDistanceNm(fromName, toName){
 const p1=atollCoords[fromName],p2=atollCoords[toName];
 if(!p1||!p2)return null;
 const toRad=Math.PI/180;
 const dLat=(p2.lat-p1.lat)*toRad;
 const dLon=(p2.lon-p1.lon)*toRad;
 const a=Math.sin(dLat/2)**2 + Math.cos(p1.lat*toRad)*Math.cos(p2.lat*toRad)*Math.sin(dLon/2)**2;
 const c=2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
 return Math.round(3440.065 * c);
}

function routeEstimateText(from, to, category){
 const nm = atollDistanceNm(from, to);
 if(!nm)return null;
 if(category==='Flights'){
  const time = nm < 80 ? '~'+Math.max(15, Math.round(nm / 3.0))+' mins' : '~'+(nm / 200).toFixed(1)+' hrs';
  return '🧭 '+nm+' NM · Flight est: '+time;
 }
 if(category==='Ships'){
  const time = (nm / 9.0).toFixed(1);
  return '🧭 '+nm+' NM · Cargo voyage est: ~'+time+' hrs';
 }
 const time = (nm / 14.0).toFixed(1);
 return '🧭 '+nm+' NM · Boat crossing est: ~'+time+' hrs';
}

function renderIslandMap(){
 const container=$('#island-map-container');
 if(!container)return;
 const currentSelected=$('#island')?.value||'All islands';
 const activeRoutes=[];
 for(const it of notices){
  if(['Boats','Ships','Flights'].includes(it.category)&&it.details?.destinationIsland){
   const routeStops=[it.island];
   if(it.details.viaIslands){
    const vias=it.details.viaIslands.split(',').map(s=>s.trim()).filter(Boolean);
    routeStops.push(...vias);
   }
   routeStops.push(it.details.destinationIsland);
   const status=it.details.flightStatus||it.details.shipStatus||it.details.boatStatus||'scheduled';
   for(let i=0;i<routeStops.length-1;i++){
    const from=mapIslands.find(m=>m.name===routeStops[i]);
    const to=mapIslands.find(m=>m.name===routeStops[i+1]);
    if(from&&to)activeRoutes.push({from,to,status,type:it.category,title:it.title});
   }
   if(it.details.returnDepartureLocal){
    const from=mapIslands.find(m=>m.name===it.details.destinationIsland);
    const to=mapIslands.find(m=>m.name===it.island);
    if(from&&to)activeRoutes.push({from,to,status,type:it.category,title:it.title+' (Return)'});
   }
  }
 }
 let svg='<svg viewBox="0 0 490 380" class="atoll-map-svg" role="img" aria-label="Interactive Kiribati Island Map"><defs><radialGradient id="lagoon-grad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#99d6c7" stop-opacity="0.6"/><stop offset="100%" stop-color="#08665d" stop-opacity="0.1"/></radialGradient></defs><rect width="100%" height="100%" rx="14" fill="#f1f7f4"/><rect x="365" y="15" width="115" height="350" rx="10" fill="#eaf2ee" stroke="#cfe0d7" stroke-dasharray="4,4"/><text x="422" y="28" text-anchor="middle" font-size="9" font-weight="700" fill="#526f65">LINE & PHOENIX</text><text x="422" y="40" text-anchor="middle" font-size="8" font-weight="700" fill="#08665d">'+new Intl.DateTimeFormat('en-GB',{timeZone:'Pacific/Kiritimati',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())+' (UTC+14)</text><text x="35" y="24" font-size="10" font-weight="700" fill="#526f65">GILBERT GROUP (TUNGARU) · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Pacific/Tarawa',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())+' (UTC+12)</text><g transform="translate(35, 368)"><text font-size="9" fill="#526f65">Routes: <tspan fill="#08665d">⛵ Boats</tspan> · <tspan fill="#1e40af">🚢 Ships</tspan> · <tspan fill="#0284c7">✈️ Flights</tspan></text></g>';
 for(const r of activeRoutes){
  const curvature=r.type==='Flights'?-0.32:r.type==='Ships'?0.22:0.12;
  const mx=(r.from.x+r.to.x)/2+(r.from.y-r.to.y)*curvature,my=(r.from.y+r.to.y)/2+(r.to.x-r.from.x)*curvature;
  const strokeColor=r.status==='delayed'?'#d97706':r.status==='cancelled'?'#dc2626':r.type==='Flights'?'#0284c7':r.type==='Ships'?'#1e40af':'#08665d';
  const dashArray=r.type==='Flights'?'4,4':r.type==='Ships'?'6,3':'5,4';
  const strokeWidth=r.type==='Flights'?'2.0':'2.3';
  svg+='<path d="M '+r.from.x+' '+r.from.y+' Q '+mx+' '+my+' '+r.to.x+' '+r.to.y+'" class="active-route-line active-'+r.type.toLowerCase()+'-line" stroke="'+strokeColor+'" stroke-dasharray="'+dashArray+'" fill="none" stroke-width="'+strokeWidth+'" opacity="0.85"><title>'+r.type+': '+r.from.name+' → '+r.to.name+'</title></path>';
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


function openPrintBulletin(){
 const island=$('#island')?.value||'All islands';
 const activeItems=notices.filter(x=>matchesListingIsland(x,island)&&(!x.expires_at||Date.parse(x.expires_at)>Date.now()));
 const w=window.open('','_blank');
 if(!w)return toast('Please allow popups to generate the printable island bulletin.');
 const departures=activeItems.filter(x=>['Boats','Ships','Flights'].includes(x.category));
 const jobs=activeItems.filter(x=>x.category==='Jobs');
 const community=activeItems.filter(x=>x.category==='Community');
 const market=activeItems.filter(x=>x.category==='Marketplace');

 let html='<!doctype html><html><head><meta charset="utf-8"><title>Island Bulletin - '+island+' - Kiribati Connect</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:30px;color:#111;max-width:800px;margin:0 auto;line-height:1.4;}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #08665d;padding-bottom:12px;margin-bottom:20px;}h1{margin:0;font-size:24px;color:#08665d;}.sub{color:#555;font-size:12px;margin-top:4px;}.sec-title{font-size:15px;font-weight:bold;background:#eef6f3;padding:6px 10px;border-left:4px solid #08665d;margin:20px 0 10px;text-transform:uppercase;letter-spacing:0.5px;}.item{border-bottom:1px solid #ddd;padding:8px 0;}.item-title{font-weight:bold;font-size:14px;}.item-meta{font-size:12px;color:#444;}.item-desc{font-size:12px;color:#333;margin-top:3px;}.qr-side{text-align:right;}.qr-side svg{width:80px;height:80px;}.print-bar{margin-bottom:20px;text-align:right;}.print-btn{padding:8px 16px;background:#08665d;color:#fff;border:0;border-radius:6px;cursor:pointer;font-weight:bold;}@media print{.print-bar{display:none;}}</style></head><body><div class="print-bar"><button class="print-btn" onclick="window.print()">🖨️ Print Bulletin (A4)</button></div><div class="hdr"><div><h1>🇰🇮 Kiribati Connect · Island Notice Bulletin</h1><div class="sub">Community & Transport Summary for <strong>'+island+'</strong> · Generated '+new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+'</div></div><div class="qr-side"><div id="b-qr"></div><div style="font-size:9px;color:#666;">Scan for live updates</div></div></div>';

 if(departures.length){
  html+='<div class="sec-title">⛵ 🚢 ✈️ Upcoming Sailings, Voyages & Flights</div>';
  for(const it of departures){
   const d=it.details||{};
   const via=d.viaIslands?' (via '+d.viaIslands+')':'';
   const ret=d.returnDepartureLocal?' · Return: '+d.returnDepartureLocal.replace('T',' '):'';
   const cargo=d.cargoAccepted?' · Cargo: '+(d.cargoStatus==='limited'?'Limited':'Accepted'):'';
   html+='<div class="item"><div class="item-title">['+it.category.toUpperCase()+'] '+it.island+' → '+(d.destinationIsland||'Outer Island')+via+' · '+it.title+'</div><div class="item-meta">Departure: <strong>'+(d.departureLocal?.replace('T',' ')||'Scheduled')+'</strong>'+ret+' · Operator: '+(it.employer||'Operator')+' · Fare: '+(d.price?d.currency+' $'+d.price:'Contact operator')+cargo+'</div><div class="item-desc">'+it.body+' (Contact: '+(it.contact||'Wharf office')+')</div></div>';
  }
 }
 if(jobs.length){
  html+='<div class="sec-title">💼 Open Job Vacancies</div>';
  for(const it of jobs){
   html+='<div class="item"><div class="item-title">'+it.title+' · '+it.employer+'</div><div class="item-meta">Closing Date: <strong>'+(it.closing_date||'Open')+'</strong> · Apply/Contact: '+it.contact+'</div><div class="item-desc">'+it.body+'</div></div>';
  }
 }
 if(community.length||market.length){
  html+='<div class="sec-title">📢 Community Notices & Marketplace</div>';
  for(const it of [...community,...market].slice(0,10)){
   const tag=it.category==='Marketplace'?(it.details?.intent==='wanted'?'[WANTED]':'[SALE]'):'[COMMUNITY]';
   const pr=it.details?.price!=null?' ('+(it.details.currency||'AUD')+' $'+it.details.price+')':'';
   html+='<div class="item"><div class="item-title">'+tag+' '+it.title+pr+' ('+it.island+')</div><div class="item-desc">'+it.body+(it.contact?' · Contact: '+it.contact:'')+'</div></div>';
  }
 }
 html+='<div style="margin-top:30px;border-top:1px dashed #888;padding-top:10px;font-size:11px;color:#666;text-align:center;">Posted from Kiribati Connect · https://kiribaticonnect.app · Keep our islands connected.</div>';

 if(typeof qrcode==='function'){
  const qr=qrcode(0,'M');
  qr.addData('https://kiribaticonnect.app/?island='+encodeURIComponent(island));
  qr.make();
  html+='<script>document.getElementById("b-qr").innerHTML = \''+qr.createSvgTag(3).replace(/\n/g,'')+'\';</script>';
 }
 html+='</body></html>';
 w.document.write(html);
 w.document.close();
}
window.openPrintBulletin=openPrintBulletin;

document.addEventListener('DOMContentLoaded',updateKiribatiClock);updateKiribatiClock();
