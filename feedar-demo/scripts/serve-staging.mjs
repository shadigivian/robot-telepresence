import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { timingSafeEqual } from 'node:crypto';

const username=process.env.STAGING_GATE_USERNAME;
const password=process.env.STAGING_GATE_PASSWORD;
const port=Number(process.env.STAGING_PORT);
if(!username||!password||password.length<16||!Number.isInteger(port)||port<1||port>65535){
 throw new Error('Set STAGING_GATE_USERNAME, a gate password of at least 16 characters, and STAGING_PORT.');
}
const expected=Buffer.from(`${username}:${password}`);
const root=resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon'};
createServer(async(request,response)=>{
 response.setHeader('Cache-Control','no-store');
 response.setHeader('X-Robots-Tag','noindex, nofollow');
 response.setHeader('X-Content-Type-Options','nosniff');
 response.setHeader('Referrer-Policy','no-referrer');
 response.setHeader('X-Frame-Options','DENY');
 const header=request.headers.authorization??'';
 let received=Buffer.alloc(0);
 if(header.startsWith('Basic '))try{received=Buffer.from(header.slice(6),'base64');}catch{/* deny */}
 if(received.length!==expected.length||!timingSafeEqual(received,expected)){
  response.writeHead(401,{'WWW-Authenticate':'Basic realm="Feedar protected staging"'}).end('Authentication required');return;
 }
 try{
  const pathname=decodeURIComponent(new URL(request.url??'/','http://localhost').pathname);
  const file=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!file.startsWith(root+sep)||!(await stat(file)).isFile()){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'}).end(await readFile(file));
 }catch{response.writeHead(404).end();}
}).listen(port,'127.0.0.1',()=>console.log(`Protected staging static server on 127.0.0.1:${port}`));
