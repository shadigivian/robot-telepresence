import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';

const cases=[['root','/',4174],['project','/base-check/',4175]];
for(const [label,base,port] of cases){
 const directory=`.qa/static-${label}`;
 const built=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--outDir',directory],{env:{...process.env,VITE_BASE_PATH:base,VITE_STAGING_DEMO:'false'},encoding:'utf8'});
 if(built.status!==0)throw new Error(built.stderr||built.stdout);
 const root=resolve(directory);
 const server=createServer(async(request,response)=>{
  try{const path=new URL(request.url,'http://localhost').pathname;if(!path.startsWith(base)){response.writeHead(404).end();return;}const relative=decodeURIComponent(path.slice(base.length))||'index.html';const file=resolve(root,relative);if(!file.startsWith(root+sep)){response.writeHead(403).end();return;}const data=await readFile(file);const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};response.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream'}).end(data);}catch{response.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  const origin=`http://127.0.0.1:${port}${base}`;
  await page.goto(origin);await page.getByRole('heading',{name:'Welcome to Feedar'}).waitFor();
  await page.goto(origin+'#/o/future-health');await page.getByRole('heading',{name:'Welcome to Feedar'}).waitFor();
  if(!page.url().endsWith('#/login'))throw new Error(`Protected route did not redirect to login: ${page.url()}`);
  await page.reload();await page.getByRole('heading',{name:'Welcome to Feedar'}).waitFor();
  if(await page.locator('.demo-switcher').count())throw new Error('Demo preview switcher is present in production build');
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(`${label} static site: assets, protected-route redirect, refresh, and no demo switcher passed (${base})`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
