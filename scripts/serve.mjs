import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root=fileURLToPath(new URL('../dist/client/',import.meta.url));
if(!existsSync(path.join(root,'index.html'))){console.error('Please run npm run build first.');process.exit(1);}
const port=Number(process.env.PORT||4173),base=await realpath(root);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.txt':'text/plain; charset=utf-8','.rsc':'text/x-component'};
const server=http.createServer(async(req,res)=>{
  try{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=path.resolve(base,'.'+name);const relative=path.relative(base,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end();return;}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    const resolved=await realpath(file),rel=path.relative(base,resolved);if(rel.startsWith('..')||path.isAbsolute(rel)){res.writeHead(403);res.end();return;}
    const info=await stat(resolved);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return;}const stream=createReadStream(resolved);stream.on('error',()=>res.destroy());stream.pipe(res);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is in use. Open http://127.0.0.1:${port}/ or set PORT to another port.`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const url=`http://127.0.0.1:${port}/`;console.log(`NACRE / STARDUST\n${url}\nPress Ctrl+C to stop.`);if(process.argv.includes('--open')){const p=process.platform==='win32'?spawn('cmd',['/c','start','',url],{windowsHide:true,stdio:'ignore'}):spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});p.on('error',()=>{});p.unref();}});
