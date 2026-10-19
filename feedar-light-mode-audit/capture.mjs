import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(new URL('../feedar-demo/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const phase=process.argv[2];
if(!['before','after'].includes(phase))throw new Error('Use before or after');
const base='http://127.0.0.1:5173/';
const output=new URL(`./screenshots/${phase}/`,import.meta.url);
const viewports=[['desktop-large',1920,1080],['laptop',1440,900],['surface-landscape',1368,912],['surface-portrait',912,1368],['tablet',768,1024],['mobile',390,844],['small-mobile',360,800]];
const records=[];const errors=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
async function setup(theme='light'){
 const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:theme,reducedMotion:'reduce'});
 await context.addInitScript(value=>{try{localStorage.setItem('feedar.theme',value);}catch{}},theme);
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push({theme,message:error.message,url:page.url()}));
 page.on('console',message=>{if(message.type()==='error')errors.push({theme,message:message.text(),url:page.url()});});
 return {context,page};
}
async function capture(page,key,route,viewport=['laptop',1440,900],theme='light'){
 const [label,width,height]=viewport;
 await page.setViewportSize({width,height});
 await page.goto(`${base}#${route}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!document.querySelector('.loading'),null,{timeout:10000}).catch(()=>{});
 await page.locator('main').first().waitFor({state:'visible',timeout:10000});
 await page.waitForTimeout(180);
 const filename=`${theme}-${key}-${label}.png`;
 const path=resolve(output.pathname,filename);
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 const details=await page.evaluate(()=>({title:document.title,theme:document.documentElement.dataset.theme,scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,svgCount:document.querySelectorAll('svg').length,background:getComputedStyle(document.body).backgroundColor,heading:document.querySelector('h1,h2')?.textContent?.trim()??''}));
 records.push({filename,route,role:key.split('-')[0],viewport:{width,height},...details});
 if(details.theme!==theme||details.scrollWidth>width)errors.push({filename,message:`Theme/overflow: ${details.theme}, ${details.scrollWidth}/${width}`});
}
async function snapCurrent(page,key,viewport=['laptop',1440,900],theme='light'){
 const [label,width,height]=viewport;const filename=`${theme}-${key}-${label}.png`;
 await page.screenshot({path:resolve(output.pathname,filename),fullPage:true,animations:'disabled'});
 records.push({filename,route:new URL(page.url()).hash.slice(1),viewport:{width,height},theme});
}
async function signIn(page,email){
 await page.goto(`${base}#/login`);await expect(page.getByLabel('Email / username')).toBeVisible();
 await page.getByLabel('Email / username').fill(email);
 await page.getByLabel('Public demo password').fill('123456');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Demo MFA code').fill('123456');
 await page.getByRole('button',{name:'Enter workspace'}).click();
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();
}
try{
 const publicLight=await setup();
 for(const viewport of viewports){
  await capture(publicLight.page,'welcome','/welcome',viewport);
  await capture(publicLight.page,'login','/login',viewport);
  await capture(publicLight.page,'public-org','/o/future-health',viewport);
  await capture(publicLight.page,'kiosk','/robot/robot-7/kiosk',viewport);
 }
 await publicLight.context.close();
 const boss=await setup();await signIn(boss.page,'boss@feedar.example');
 for(const [key,route] of [['boss-overview','/overview'],['boss-organizations','/organizations'],['boss-robot-management','/robot-management'],['boss-robot-monitoring','/robot-monitoring'],['boss-support','/boss/support'],['boss-settings','/settings']])await capture(boss.page,key,route);
 for(const viewport of viewports)await capture(boss.page,'boss-overview','/overview',viewport);
 await boss.page.setViewportSize({width:1440,height:900});await boss.page.goto(`${base}#/organizations`);await expect(boss.page.getByRole('button',{name:'Create organization',exact:true})).toBeVisible();
 await boss.page.getByRole('button',{name:'Create organization'}).click();
 await expect(boss.page.getByRole('dialog',{name:'Create organization'})).toBeVisible();await snapCurrent(boss.page,'boss-create-org-dialog');
 await boss.page.getByRole('dialog',{name:'Create organization'}).getByLabel('Organization name',{exact:true}).focus();await snapCurrent(boss.page,'boss-create-org-dialog-focus');
 await boss.page.keyboard.press('Escape');
 await boss.page.getByRole('button',{name:'Notifications'}).click();await expect(boss.page.getByRole('dialog',{name:'Notifications'})).toBeVisible();await snapCurrent(boss.page,'boss-notifications-dialog');
 await boss.context.close();
 const owner=await setup();await signIn(owner.page,'owner@futurehealth.example');
 for(const [key,route] of [['org-info','/org/info'],['org-users','/org/users'],['org-robots','/org/robots'],['org-status','/org/status'],['org-telepresence','/org/telepresence'],['org-billing-support','/org/billing-support'],['org-operations','/operations'],['org-maps','/maps'],['org-activity','/activity'],['org-settings','/settings'],['org-knowledge','/knowledge']])await capture(owner.page,key,route);
 for(const viewport of viewports){await capture(owner.page,'org-status','/org/status',viewport);await capture(owner.page,'org-telepresence','/org/telepresence',viewport);}
 await owner.page.goto(`${base}#/org/robots`);await expect(owner.page.getByRole('button',{name:'Edit'}).first()).toBeVisible();await owner.page.getByRole('button',{name:'Edit'}).first().click();await expect(owner.page.getByRole('dialog',{name:'Edit organization robot'})).toBeVisible();await snapCurrent(owner.page,'org-robot-edit-dialog',viewports[6]);
 await owner.context.close();
 const admin=await setup();await signIn(admin.page,'admin@futurehealth.example');
 for(const [key,route] of [['admin-overview','/overview'],['admin-users','/org/users'],['admin-robots','/org/robots'],['admin-telepresence','/org/telepresence']])await capture(admin.page,key,route);
 await capture(admin.page,'admin-users','/org/users',viewports[5]);await admin.context.close();
 const user=await setup();await signIn(user.page,'user@futurehealth.example');
 for(const [key,route] of [['user-remote','/remote'],['user-status','/org/status'],['user-support','/org/billing-support']])await capture(user.page,key,route);
 await capture(user.page,'user-remote','/remote',viewports[5]);await user.context.close();
 const dark=await setup('dark');
 for(const [key,route] of [['welcome','/welcome'],['login','/login'],['public-org','/o/future-health'],['kiosk','/robot/robot-7/kiosk']])await capture(dark.page,key,route,viewports[1],'dark');
 await signIn(dark.page,'boss@feedar.example');for(const [key,route] of [['boss-overview','/overview'],['boss-support','/boss/support']])await capture(dark.page,key,route,viewports[1],'dark');
 await signIn(dark.page,'owner@futurehealth.example');for(const [key,route] of [['org-status','/org/status'],['org-telepresence','/org/telepresence']])await capture(dark.page,key,route,viewports[5],'dark');
 await dark.context.close();
}finally{await browser.close();await writeFile(new URL(`./${phase}-manifest.json`,import.meta.url),JSON.stringify({phase,count:records.length,records,errors},null,2));console.log(`${phase}: ${records.length} screenshots, ${errors.length} errors`);if(errors.length)console.log(JSON.stringify(errors.slice(0,20),null,2));}
