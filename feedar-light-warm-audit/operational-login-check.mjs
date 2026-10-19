import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require=createRequire(new URL('../feedar-demo/package.json',import.meta.url));
const { chromium,expect }=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
const origins=[
 {name:'boss',url:'http://127.0.0.1:4181',valid:'boss@feedar.example',wrong:'owner@futurehealth.example',title:'Feedar Control Center'},
 {name:'organization',url:'http://127.0.0.1:4182',valid:'owner@futurehealth.example',wrong:'boss@feedar.example',title:'Welcome to Feedar'},
];
try{
 for(const portal of origins){
  for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]){
   const context=await browser.newContext({viewport:{width,height},colorScheme:'light',reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto(`${portal.url}/#/login`);
   await expect(page.getByRole('heading',{name:portal.title})).toBeVisible();
   await expect(page.locator('.operational-card')).toHaveCSS('background-color','rgb(250, 248, 245)');
   await expect(page.locator('aside.demo-switcher,.demo-accounts')).toHaveCount(0);
   await page.screenshot({path:resolve(`feedar-light-warm-audit/screenshots/after/staging-${portal.name}-light-${size}.png`),fullPage:true});
   await page.getByRole('button',{name:'Switch to dark mode'}).click();
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   await page.screenshot({path:resolve(`feedar-light-warm-audit/screenshots/after/staging-${portal.name}-dark-${size}.png`),fullPage:true});
   await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
   await page.getByRole('button',{name:'Switch to light mode'}).click();
   if(size==='desktop'){
    await page.getByLabel('Email').fill(portal.wrong);
    await page.getByLabel('Password',{exact:true}).fill('123456');
    await page.getByRole('button',{name:'Sign In'}).click();
    await expect(page.getByRole('alert')).toContainText('cannot sign in on this workspace');
    await page.getByLabel('Email').fill(portal.valid);
    await page.getByRole('button',{name:'Sign In'}).click();
    await expect(page.getByLabel('Verification code')).toBeVisible();
    await page.getByLabel('Verification code').fill('123456');
    await page.getByRole('button',{name:'Enter workspace'}).click();
    await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();
    await page.getByRole('button',{name:'Open profile'}).click();
    await page.getByRole('button',{name:'Sign out'}).click();
    await expect(page.getByRole('heading',{name:portal.title})).toBeVisible();
   }
   if(errors.length)throw new Error(`${portal.name} ${size}: ${errors.join('; ')}`);
   results.push({portal:portal.name,size,passed:true});
   await context.close();
  }
 }
}finally{await browser.close();}
console.log(JSON.stringify(results));
