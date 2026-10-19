import {expect,test} from '@playwright/test';

test.use({hasTouch:true});

for(const theme of ['light','dark'] as const)for(const [size,width,height] of [['desktop',1440,900],['mobile',390,844]] as const){
 test(`Login password visibility works in ${theme} at ${size}`,async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.setViewportSize({width,height});
  await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
  await page.goto('./#/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
  const input=page.getByLabel('Public demo password');
  const show=page.getByRole('button',{name:'Show password'});
  await expect(input).toHaveAttribute('type','password');
  await expect(show).toHaveAttribute('type','button');
  await expect(show).toHaveAttribute('aria-pressed','false');
  await expect(show.locator('svg')).toHaveClass(/lucide-eye(?:\s|$)/);
  await expect(show).toBeVisible();
  const metrics=await show.evaluate(element=>{
   const button=element.getBoundingClientRect(),field=element.previousElementSibling as HTMLElement,icon=element.querySelector('svg')!.getBoundingClientRect();
   const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
   const luminance=(value:string)=>rgb(value).map(channel=>{const x=channel/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((sum,channel,i)=>sum+channel*[.2126,.7152,.0722][i],0);
   const foreground=luminance(getComputedStyle(element).color),background=luminance(getComputedStyle(field).backgroundColor);
   return {width:button.width,height:button.height,iconCentered:Math.abs((icon.x+icon.width/2)-(button.x+button.width/2))<1,contrast:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};
  });
  expect(metrics.width).toBeGreaterThanOrEqual(44);
  expect(metrics.height).toBeGreaterThanOrEqual(44);
  expect(metrics.iconCentered).toBe(true);
  expect(metrics.contrast).toBeGreaterThanOrEqual(4.5);
  await input.fill('sample-password');
  if(size==='mobile')await show.tap();else await show.click();
  const hide=page.getByRole('button',{name:'Hide password'});
  await expect(input).toHaveAttribute('type','text');
  await expect(input).toHaveValue('sample-password');
  await expect(hide).toHaveAttribute('aria-pressed','true');
  await expect(hide.locator('svg')).toHaveClass(/lucide-eye-off/);
  await expect(input).toBeFocused();
  await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(hide).toBeFocused();
  await expect.poll(()=>hide.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(input).toHaveAttribute('type','password');
  await expect(show).toBeFocused();
  await page.keyboard.press('Space');
  await expect(input).toHaveAttribute('type','text');
  await expect(input).toHaveValue('sample-password');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect(input).toHaveAttribute('type','password');
  await expect(page.getByRole('button',{name:'Show password'})).toBeVisible();
  expect(errors).toEqual([]);
 });
}
