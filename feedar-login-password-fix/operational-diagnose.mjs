import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../feedar-demo/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{
 for(const [portal,port] of [['boss',4181],['organization',4182]])for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(t=>localStorage.setItem('feedar.theme',t),theme);
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${port}/#/login`);
  const input=page.getByLabel('Password',{exact:true}),show=page.getByRole('button',{name:'Show password'});
  await expect(input).toHaveAttribute('type','password');await input.fill('sample-password');
  const style=await show.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{width:r.width,height:r.height,color:s.color,background:s.backgroundColor,type:el.getAttribute('type'),pressed:el.getAttribute('aria-pressed')}});
  await show.screenshot({path:`feedar-login-password-fix/after/operational-${portal}-${theme}-${size}.png`});
  if(size==='mobile')await show.tap();else await show.click();
  const hide=page.getByRole('button',{name:'Hide password'});
  await expect(input).toHaveAttribute('type','text');await expect(input).toHaveValue('sample-password');await expect(input).toBeFocused();
  await expect(hide).toHaveAttribute('aria-pressed','true');await expect(hide.locator('svg')).toHaveClass(/lucide-eye-off/);
  await page.keyboard.press('Tab');await expect(hide).toBeFocused();await page.keyboard.press('Enter');await expect(input).toHaveAttribute('type','password');
  await page.keyboard.press('Space');await expect(input).toHaveAttribute('type','text');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();await expect(input).toHaveAttribute('type','password');
  if(style.width<44||style.height<44||errors.length)throw new Error(`${portal}/${size}/${theme}: ${JSON.stringify({style,errors})}`);
  results.push({portal,size,theme,style,errors});await context.close();
 }
}finally{await browser.close();}
await writeFile('feedar-login-password-fix/after/operational-diagnostics.json',JSON.stringify(results,null,2));
console.log(`${results.length} operational Login combinations passed`);
