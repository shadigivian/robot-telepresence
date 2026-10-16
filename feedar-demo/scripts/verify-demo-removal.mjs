import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory=resolve('../feedar-demo-removal-results/screenshots');
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL});
let checks=0;
try{
 for(const [mode,surface,port,title] of [['development','boss',5183,'Feedar Control Center'],['development','organization',5184,'Welcome to Feedar'],['build','boss',4183,'Feedar Control Center'],['build','organization',4184,'Welcome to Feedar']]){
  for(const [size,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`http://127.0.0.1:${port}/#/login`);
   await page.getByRole('heading',{name:title}).waitFor();
   if(await page.locator('aside.demo-switcher,.demo-accounts,#root > aside').count())throw Error(`${mode} ${surface} ${size}: demo node present`);
   if(await page.getByText('Demo preview').count()||await page.getByText('Use a demo account').count())throw Error(`${mode} ${surface} ${size}: demo text present`);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(`${mode} ${surface} ${size}: horizontal overflow`);
   if(errors.length)throw Error(errors.join('\n'));
   await page.screenshot({path:resolve(directory,`${mode}-${surface}-${size}.png`),fullPage:true});
   checks++;
   await page.goto(`http://127.0.0.1:${port}/#/overview`);
   await page.getByRole('heading',{name:title}).waitFor();
   if(!page.url().endsWith('#/login'))throw Error(`${mode} ${surface}: protected route opened`);
   if(await page.locator('aside.demo-switcher,.demo-accounts').count())throw Error(`${mode} ${surface}: demo node on redirect`);
   checks++;
   await page.close();
  }
 }
 console.log(`${checks} development/build DOM and route checks passed; 8 screenshots saved`);
}finally{await browser.close();}
