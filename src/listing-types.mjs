import catalog from '../public/islands.json' with {type:'json'};
export const ISLANDS=catalog.groups.flatMap(group=>group.islands.map(island=>island.name));
export const CATEGORIES=['Community','Jobs','Boats','Ships','Flights','Marketplace'];
export function islandOffset(island){const group=catalog.groups.find(group=>group.islands.some(item=>item.name===island))?.name;if(!group)throw Error('Choose a valid island.');return group==='Line Islands'?14:group==='Phoenix Islands'?13:12}
function calendarDate(date){if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a valid date.');const value=Date.parse(date+'T00:00:00.000Z');if(!Number.isFinite(value)||new Date(value).toISOString().slice(0,10)!==date)throw Error('Choose a valid date.');return value}
function expireAt(date,island){return new Date(calendarDate(date)+86400000-islandOffset(island)*3600000).toISOString()}
function departureAt(local,island){if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw Error('Choose a valid departure date and time.');calendarDate(local.slice(0,10));const parsed=Date.parse(local+':00.000Z');if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,16)!==local)throw Error('Choose a valid departure date and time.');return new Date(parsed-islandOffset(island)*3600000).toISOString()}
function field(value,max,label,required=false){const text=typeof value==='string'?value.trim():'';if(text.length>max||(required&&!text))throw Error(label+(required?' is required':' is too long')+' (up to '+max+' characters).');return text}
function httpsUrl(value){if(!value)return '';let url;try{url=new URL(value)}catch{throw Error('Enter a valid HTTPS photo URL.')}const host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||value.length>1000)throw Error('Use an HTTPS URL without a password or custom port.');if(!host.includes('.')||host==='localhost'||/^(\d{1,3}\.){3}\d{1,3}$/.test(host)||host.includes(':')||/\.(local|internal|localhost)$/.test(host))throw Error('Use a public HTTPS photo URL.');return url.href}
function amount(value,required){if(value==null||value===''){if(required)throw Error('Enter a price, including 0 for a free item.');return null}if(typeof value!=='string'&&typeof value!=='number'||!/^\d{1,8}(\.\d{1,2})?$/.test(String(value)))throw Error('Enter a non-negative amount with up to two decimal places.');const number=Number(value);if(number>10000000)throw Error('The amount is too large.');return number}
export function normalizeListing(data,now){
 const title=field(data?.title,100,'Title',true),body=field(data?.body,1000,'Description',true),island=data?.island,category=data?.category??'Community';
 if(!ISLANDS.includes(island)||!CATEGORIES.includes(category))throw Error('Choose a valid island and listing type.');
 let employer=null,contact=null,closing_date=null,expires_at=null,confirmed_at=null;const details={};
 if(category!=='Community'){
  const employerLabel=category==='Jobs'?'Employer':category==='Boats'?'Boat operator':category==='Ships'?'Shipping line / vessel name':category==='Flights'?'Airline / operator':'Seller name';
  employer=field(data.employer,100,employerLabel,true);
  contact=field(data.contact,200,'Contact',true)||null;
 }
 if(category==='Jobs'){if(!data.closingDate)throw Error('Choose a job closing date.');closing_date=data.closingDate;expires_at=expireAt(closing_date,island)}
 else if(category==='Boats'||category==='Ships'||category==='Flights'){
  if(!ISLANDS.includes(data.destinationIsland)||data.destinationIsland===island)throw Error('Choose a destination different from the departure island.');
  const rawStatus=category==='Flights'?(data.flightStatus||data.boatStatus):category==='Ships'?(data.shipStatus||data.boatStatus):(data.boatStatus);
  const status=rawStatus||'scheduled';
  const statusTypeLabel=category==='Flights'?'flight':category==='Ships'?'voyage':'sailing';
  if(!['scheduled','delayed','cancelled','departed'].includes(status))throw Error('Choose a valid '+statusTypeLabel+' status.');
  const departureUtc=departureAt(data.departureLocal,island);
  if(status!=='cancelled'&&status!=='departed'&&departureUtc<=now)throw Error('Choose a future departure time at the departure island.');
  const isConfirmed=data.boatConfirmed===true||(category==='Ships'&&data.shipConfirmed===true)||(category==='Flights'&&data.flightConfirmed===true);
  if(!isConfirmed)throw Error('Confirm that you checked these details with the operator.');
  const currency=data.currency||'AUD';if(!['AUD','USD','NZD'].includes(currency))throw Error('Choose a supported currency.');
  const cargoAccepted=data.cargoAccepted===true||data.cargoAccepted==='yes'||data.cargoAccepted==='1';
  const cargoStatus=['open','limited','none'].includes(data.cargoStatus)?data.cargoStatus:(cargoAccepted?'open':'none');
  const cargoTypes=field(data.cargoTypes,150,'Cargo types');
  const cargoRate=field(data.cargoRate,100,'Cargo rate');
  const flightNumber=category==='Flights'?field(data.flightNumber,30,'Flight number'):'';
  const aircraftType=category==='Flights'?field(data.aircraftType,50,'Aircraft type'):'';
  const baggageAllowance=category==='Flights'?field(data.baggageAllowance,100,'Baggage allowance'):'';
  const vesselName=category==='Ships'?field(data.vesselName,100,'Vessel name'):'';
  Object.assign(details,{
    destinationIsland:data.destinationIsland,
    departureLocal:data.departureLocal,
    departureUtc,
    utcOffset:islandOffset(island),
    boatStatus:status,
    shipStatus:status,
    flightStatus:status,
    price:amount(data.price,false),
    currency,
    cargoAccepted,
    cargoStatus,
    cargoTypes,
    cargoRate,
    flightNumber,
    aircraftType,
    baggageAllowance,
    vesselName
  });
  confirmed_at=now;expires_at=new Date(Date.parse(departureUtc)+86400000).toISOString();
 }else{
  if(data.expiresOn)expires_at=expireAt(data.expiresOn,island);
  if(category==='Marketplace'){
   const currency=data.currency||'AUD';if(!['AUD','USD','NZD'].includes(currency))throw Error('Choose a supported currency.');
   if(!['new','used'].includes(data.condition))throw Error('Choose new or used condition.');if(!['available','reserved'].includes(data.availability||'available'))throw Error('Choose a valid availability.');
   Object.assign(details,{price:amount(data.price,true),currency,condition:data.condition,availability:data.availability||'available',photoUrl:httpsUrl(field(data.photoUrl,1000,'Photo URL'))});
   if(!expires_at)expires_at=new Date(Date.parse(now)+30*86400000).toISOString();
  }
 }
 if(expires_at&&expires_at<=now)throw Error('Choose a date that has not ended on the selected island.');
 return {title,body,island,category,employer,contact,closing_date,expires_at,details_json:JSON.stringify(details),source_verified:0,confirmed_at};
}
function describe(row,details){
 const lines=[];
 if(row.category==='Jobs')lines.push('Employer: '+row.employer,'Apply/contact: '+row.contact,'Closing date: '+row.closing_date,'Status: '+(row.status==='closed'?'position filled':'open'));
 else if(row.category==='Boats')lines.push('Operator: '+row.employer,'Route: '+row.island+' → '+details.destinationIsland,'Departure: '+details.departureLocal?.replace('T',' ')+' (UTC+'+details.utcOffset+', departure island time)','Sailing status: '+(row.status==='closed'?'departed':details.boatStatus),'Fare: '+(details.price==null?'Contact operator':details.currency+' '+Number(details.price).toFixed(2)),details.cargoAccepted?'Cargo: '+(details.cargoStatus==='limited'?'Limited space':'Cargo accepted')+(details.cargoTypes?' ('+details.cargoTypes+')':'')+(details.cargoRate?' · Rate: '+details.cargoRate:''):'', 'Operator contact: '+row.contact,'Contributor checked with operator: '+row.confirmed_at,'Confirm the latest sailing details with the operator before travel.');
 else if(row.category==='Ships')lines.push('Shipping line / vessel: '+row.employer+(details.vesselName?' ('+details.vesselName+')':''),'Route: '+row.island+' → '+details.destinationIsland,'Departure: '+details.departureLocal?.replace('T',' ')+' (UTC+'+details.utcOffset+', departure island time)','Voyage status: '+(row.status==='closed'?'departed':details.shipStatus||details.boatStatus),'Fare: '+(details.price==null?'Contact shipping line':details.currency+' '+Number(details.price).toFixed(2)),details.cargoAccepted?'Cargo / Freight: '+(details.cargoStatus==='limited'?'Limited space':'Cargo accepted')+(details.cargoTypes?' ('+details.cargoTypes+')':'')+(details.cargoRate?' · Rate: '+details.cargoRate:''):'','Operator contact: '+row.contact,'Contributor checked with operator: '+row.confirmed_at,'Confirm the latest voyage details with the shipping company before cargo drop-off or travel.');
 else if(row.category==='Flights')lines.push('Airline: '+row.employer+(details.flightNumber?' · Flight '+details.flightNumber:'')+(details.aircraftType?' ('+details.aircraftType+')':''),'Route: '+row.island+' → '+details.destinationIsland,'Departure: '+details.departureLocal?.replace('T',' ')+' (UTC+'+details.utcOffset+', departure island time)','Flight status: '+(row.status==='closed'?'departed':details.flightStatus||details.boatStatus),'Airfare: '+(details.price==null?'Contact airline':details.currency+' '+Number(details.price).toFixed(2)),details.baggageAllowance?'Baggage: '+details.baggageAllowance:'',details.cargoAccepted?'Air freight: '+(details.cargoRate?'Rate: '+details.cargoRate:'Accepted'):'','Airline contact: '+row.contact,'Contributor checked with airline: '+row.confirmed_at,'Confirm flight check-in time and terminal details before heading to the airport.');
 else if(row.category==='Marketplace')lines.push('Seller: '+row.employer,'Price: '+details.currency+' '+Number(details.price).toFixed(2),'Condition: '+details.condition,'Availability: '+(row.status==='closed'?'sold':details.availability),'Seller contact: '+row.contact);
 else lines.push('Community notice.');
 if(row.expires_at)lines.push('Expires: '+new Date(row.expires_at).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC.');
 return lines.filter(Boolean).join('\n');
}
export function withDetails(row){let details={};try{details=JSON.parse(row.details_json||'{}')}catch{}const {details_json,...rest}=row;return {...rest,details,detail:describe(row,details)}}
export function publicListing(row){const item=withDetails(row);return {...item,source:row.category+' · Published'}}
