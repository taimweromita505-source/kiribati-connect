import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const esbuild=process.argv[2]?await import(pathToFileURL(process.argv[2]).href):await import('esbuild');
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'application/javascript',json:'application/json',svg:'image/svg+xml'};
const assets={};for(const name of readdirSync('public'))assets['/'+name]={body:readFileSync('public/'+name,'utf8'),type:types[name.split('.').pop()]||'text/plain'};
writeFileSync('src/assets.generated.mjs','export const assets='+JSON.stringify(assets)+';');mkdirSync('dist',{recursive:true});
await esbuild.build({entryPoints:['src/worker.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/worker.mjs',minify:true});
console.log('Built standalone Worker with '+Object.keys(assets).length+' embedded assets.');
