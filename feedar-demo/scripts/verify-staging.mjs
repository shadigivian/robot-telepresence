import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const gate={username:process.env.STAGING_GATE_USERNAME,password:process.env.STAGING_GATE_PASSWORD};
if(!gate.username||!gate.password)throw new Error('Set STAGING_GATE_USERNAME and STAGING_GATE_PASSWORD for the local test.');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL});
let passed=0;
async function check(surface,port,email,landing){
 const context=await browser.newContext({httpCredentials:gate});
 const page=await context.newPage();
 const origin=`http://127.0.0.1:${port}`;
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${origin}/#/login`);
 await expect(page.getByRole('heading',{name:surface==='boss'?'Feedar Control Center':'Welcome to Feedar'})).toBeVisible();passed++;
 await expect(page.locator('aside.demo-switcher,.demo-accounts')).toHaveCount(0);passed++;
 await page.getByLabel('Email').fill(email);
 await page.getByLabel('Password',{exact:true}).fill('123456');
 await page.getByRole('button',{name:'Sign In'}).click();
 await page.getByLabel('Verification code').fill('123456');
 await page.getByRole('button',{name:'Enter workspace'}).click();
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();
 await page.goto(`${origin}/#${landing}`);
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();passed++;
 await page.reload();
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();passed++;
 if(email==='user@futurehealth.example'){
  await page.goto(`${origin}/#/organizations`);
  await expect(page.getByRole('heading',{name:'Access unavailable'})).toBeVisible();passed++;
 }
 await page.getByRole('button',{name:'Open profile'}).click();
 await page.getByRole('dialog',{name:'Demo profile'}).getByRole('button',{name:'Sign out'}).click();
 await expect(page.getByRole('heading',{name:surface==='boss'?'Feedar Control Center':'Welcome to Feedar'})).toBeVisible();passed++;
 if(errors.length)throw Error(errors.join('\n'));
 await context.close();
}
try{
 for(const port of [4183,4184]){
  const response=await fetch(`http://127.0.0.1:${port}/`);
  if(response.status!==401)throw Error(`Gate on ${port} returned ${response.status}`);
  passed++;
 }
 const index=await readFile('dist/index.html','utf8');
 const asset=index.match(/src="([^"]+\.js)"/)?.[1];if(!asset)throw Error('Built JS asset missing');
 if((await fetch(`http://127.0.0.1:4183${asset}`)).status!==401)throw Error('Asset bypassed gate');passed++;
 await check('boss',4183,'boss@feedar.example','/overview');
 await check('app',4184,'owner@futurehealth.example','/org/info');
 await check('app',4184,'admin@futurehealth.example','/operations');
 await check('app',4184,'user@futurehealth.example','/remote');
 for(const [port,email] of [[4183,'owner@futurehealth.example'],[4184,'boss@feedar.example']]){
  const context=await browser.newContext({httpCredentials:gate});const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/#/login`);
  await page.getByLabel('Email').fill(email);await page.getByLabel('Password',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'Sign In'}).click();
  await expect(page.getByRole('alert')).toContainText('cannot sign in on this workspace');passed++;
  await context.close();
 }
 console.log(`${passed} staging build, gate, login, refresh, logout and wrong-origin checks passed`);
}finally{await browser.close();}
