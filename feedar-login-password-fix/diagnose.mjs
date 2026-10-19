import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(new URL('../feedar-demo/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const stage=process.argv[2];if(!['before','after'].includes(stage))throw new Error('Pass before or after');
const root=resolve('feedar-login-password-fix',stage);await mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
 for(const theme of ['light','dark'])for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(t=>localStorage.setItem('feedar.theme',t),theme);
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/#/login');
  await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();
  const input=page.getByLabel('Public demo password');const button=page.getByRole('button',{name:'Show password'});
  await input.fill('sample-password');
  await page.screenshot({path:resolve(root,`${theme}-${size}-default.png`),fullPage:true});
  await button.hover();await page.screenshot({path:resolve(root,`${theme}-${size}-hover.png`),fullPage:true});
  await button.focus();await page.screenshot({path:resolve(root,`${theme}-${size}-focus.png`),fullPage:true});
  const initial=await button.evaluate(el=>{const b=el.getBoundingClientRect(),s=getComputedStyle(el),input=el.previousElementSibling;const i=input&&getComputedStyle(input);return {type:el.getAttribute('type'),label:el.getAttribute('aria-label'),icon:el.querySelector('svg')?.getAttribute('class'),color:s.color,background:s.backgroundColor,border:s.borderColor,outline:s.outline,box:{x:b.x,y:b.y,width:b.width,height:b.height},inputBackground:i?.backgroundColor,inputColor:i?.color,inputOutline:i?.outline,focused:document.activeElement===el};});
  await button.click();
  const revealed={type:await input.getAttribute('type'),value:await input.inputValue(),icon:await page.getByRole('button',{name:'Hide password'}).locator('svg').getAttribute('class'),label:await page.getByRole('button',{name:'Hide password'}).getAttribute('aria-label'),focusedInput:await input.evaluate(el=>document.activeElement===el),formSubmitted:await page.getByRole('heading',{name:'Demo verification'}).count()>0};
  await page.screenshot({path:resolve(root,`${theme}-${size}-revealed.png`),fullPage:true});
  await page.getByRole('button',{name:'Hide password'}).click();
  const hidden={type:await input.getAttribute('type'),value:await input.inputValue(),icon:await page.getByRole('button',{name:'Show password'}).locator('svg').getAttribute('class')};
  results.push({theme,size,initial,revealed,hidden,errors});await context.close();
 }
}finally{await browser.close();}
await writeFile(resolve(root,'diagnostics.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({theme,size,initial,revealed,hidden,errors})=>({theme,size,button:{color:initial.color,background:initial.background,border:initial.border,outline:initial.outline,box:initial.box},revealed,hidden,errors})),null,2));
