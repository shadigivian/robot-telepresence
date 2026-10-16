import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const output=resolve('../feedar-login-results/screenshots');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL});
let checks=0;
try{
 for(const [surface,port,title] of [['boss',4183,'Feedar Control Center'],['organization',4184,'Welcome to Feedar']]){
  for(const [size,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
   const page=await browser.newPage({viewport});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`http://127.0.0.1:${port}/#/login`);
   await page.getByRole('heading',{name:title}).waitFor();
   for(const theme of ['light','dark']){
    if(theme==='dark'){await page.getByRole('button',{name:'Switch to dark mode'}).click();await page.waitForTimeout(250);}
    if(await page.locator('.operational-login').getAttribute('data-theme')!==theme)throw Error(`${surface} ${size}: wrong theme`);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error(`${surface} ${size} ${theme}: horizontal overflow`);
    await page.screenshot({path:resolve(output,`${surface}-${size}-${theme}.png`),fullPage:true});checks++;
   }
   await page.getByRole('button',{name:'Switch to light mode'}).click();
   if(await page.locator('.demo-switcher,.demo-accounts').count())throw Error(`${surface}: demo controls visible`);
   await page.getByRole('button',{name:'Sign In'}).click();
   await page.getByText('Enter your email address.').waitFor();
   await page.getByText('Enter your password.').waitFor();checks++;
   await page.getByLabel('Email').fill('invalid');
   await page.getByRole('button',{name:'Sign In'}).click();
   await page.getByText('Enter a valid email address.').waitFor();checks++;
   await page.getByLabel('Email').fill('person@example.com');
   await page.getByLabel('Password',{exact:true}).fill('example-pass');
   await page.getByRole('button',{name:'Show password'}).click();
   if(await page.getByLabel('Password',{exact:true}).getAttribute('type')!=='text')throw Error('Password did not show');
   await page.getByRole('button',{name:'Hide password'}).click();
   if(await page.getByLabel('Password',{exact:true}).getAttribute('type')!=='password')throw Error('Password did not hide');checks++;
   await page.getByRole('button',{name:'Sign In'}).click();
   await page.getByRole('button',{name:'Checking availability…'}).waitFor();
   await page.getByRole('alert').waitFor();checks++;
   await page.goto(`http://127.0.0.1:${port}/#/overview`);
   await page.getByRole('heading',{name:title}).waitFor();
   if(!page.url().endsWith('#/login'))throw Error(`${surface}: protected route not redirected`);checks++;
   if(errors.length)throw Error(errors.join('\n'));
   await page.close();
  }
 }
 console.log(`${checks} operational login browser checks passed; 8 screenshots saved`);
}finally{await browser.close();}
