import { chromium, expect } from '@playwright/test';

const gate={username:process.env.STAGING_GATE_USERNAME,password:process.env.STAGING_GATE_PASSWORD};
if(!gate.username||!gate.password)throw Error('Missing gate credentials');
const boss='https://80.249.113.32';
const app='https://80.249.113.32:8443';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
let passed=0;

async function signIn(origin,email,landing,label){
 const context=await browser.newContext({httpCredentials:gate});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${origin}/#/login`);
 await expect(page.getByRole('heading',{name:label})).toBeVisible();passed++;
 await expect(page.locator('aside.demo-switcher,.demo-accounts')).toHaveCount(0);passed++;
 await page.getByLabel('Email').fill(email);
 await page.getByLabel('Password',{exact:true}).fill('123456');
 await page.getByRole('button',{name:'Sign In'}).click();
 await page.getByLabel('Verification code').fill('123456');
 await page.getByRole('button',{name:'Enter workspace'}).click();
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();passed++;
 await page.goto(`${origin}/#${landing}`);
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();passed++;
 await page.reload();
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();passed++;
 if(email==='user@futurehealth.example'){
  await page.goto(`${origin}/#/organizations`);
  await expect(page.getByRole('heading',{name:'Access unavailable'})).toBeVisible();passed++;
 }
 if(email==='boss@feedar.example')await page.screenshot({path:'.qa/live-boss-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Open profile'}).click();
 await page.getByRole('dialog',{name:'Demo profile'}).getByRole('button',{name:'Sign out'}).click();
 await expect(page.getByRole('heading',{name:label})).toBeVisible();passed++;
 if(errors.length)throw Error(errors.join('\n'));
 await context.close();
}

try{
 for(const origin of [boss,app]){
  const response=await fetch(`${origin}/`);
  if(response.status!==401)throw Error(`Gate returned ${response.status} on ${origin}`);
  passed++;
 }
 const asset=await fetch(`${boss}/assets/index-7A62xF56.js`);
 if(asset.status!==401)throw Error(`Asset gate returned ${asset.status}`);
 passed++;
 await signIn(boss,'boss@feedar.example','/overview','Feedar Control Center');
 await signIn(app,'owner@futurehealth.example','/org/info','Welcome to Feedar');
 await signIn(app,'admin@futurehealth.example','/operations','Welcome to Feedar');
 await signIn(app,'user@futurehealth.example','/remote','Welcome to Feedar');
 for(const [origin,email] of [[boss,'owner@futurehealth.example'],[app,'boss@feedar.example']]){
  const context=await browser.newContext({httpCredentials:gate});const page=await context.newPage();
  await page.goto(`${origin}/#/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'Sign In'}).click();
  await expect(page.getByRole('alert')).toContainText('cannot sign in on this workspace');passed++;
  await context.close();
 }
 console.log(`${passed} live HTTPS staging checks passed`);
}finally{await browser.close();}
