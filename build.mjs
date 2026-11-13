import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const esbuild=process.argv[2]?await import(pathToFileURL(process.argv[2]).href):await import('esbuild');
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'application/javascript',json:'application/json',svg:'image/svg+xml'};
const assets={};for(const name of readdirSync('public'))assets['/'+name]={body:readFileSync('public/'+name,'utf8'),type:types[name.split('.').pop()]||'text/plain'};
assets['/.well-known/assetlinks.json']=assets['/assetlinks.json'];delete assets['/assetlinks.json'];
const catalog=JSON.parse(readFileSync('public/islands.json','utf8'));
const escape=text=>text.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function islandOptions(selected){return catalog.groups.map(group=>'<optgroup label="'+escape(group.name)+'">'+group.islands.map(island=>'<option value="'+escape(island.name)+'"'+(island.name===selected?' selected':'')+(island.includes?' data-members="'+escape(island.includes.join('|'))+'"':'')+'>'+escape(island.label||island.name)+'</option>').join('')+'</optgroup>').join('')}
assets['/community.html'].body=assets['/community.html'].body
 .replace(/(<select id="island">)[\s\S]*?(<\/select>)/,'$1<option>All islands</option>'+islandOptions()+'$2')
 .replace(/(<select name="island" required>)[\s\S]*?(<\/select>)/,'$1<option value="">Choose a target island</option>'+islandOptions()+'$2')
 .replace(/(<select name="destinationIsland">)[\s\S]*?(<\/select>)/,'$1'+islandOptions('Abaiang')+'$2');
writeFileSync('src/assets.generated.mjs','export const assets='+JSON.stringify(assets)+';');mkdirSync('dist',{recursive:true});
await esbuild.build({entryPoints:['src/worker.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/worker.mjs',minify:true});
console.log('Built standalone Worker with '+Object.keys(assets).length+' embedded assets.');
