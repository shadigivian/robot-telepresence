import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/demo-login';

test('theme follows system, persists choice, and carries across Boss and organization views',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('./#/login');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.emulateMedia({colorScheme:'dark'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({colorScheme:'light'});
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('feedar.theme'))).toBe('dark');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await signInDemo(page,'Boss');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.goto('./#/organizations');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('.panel').first()).toBeVisible();
 await expect.poll(()=>page.locator('.panel').first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(250, 248, 245)');
 await page.goto('./#/settings');
 await page.getByLabel('Color theme').selectOption('system');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('feedar.theme'))).toBe(null);
});

test('robot status icons and mobile theme control render in both modes',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.emulateMedia({colorScheme:'light'});
 await page.setViewportSize({width:390,height:844});
 await signInDemo(page,'Org');
 await page.goto('./#/org/status');
 await expect(page.getByRole('heading',{name:'Robot Status'})).toBeVisible();
 await expect(page.locator('.status-indicator').first()).toBeVisible();
 await expect(page.locator('.status-indicator svg').first()).toBeVisible();
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await expect(page.locator('.status-indicator').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('light kiosk controls and telepresence telemetry remain readable',async({page})=>{
 await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('./#/robot/robot-7/kiosk');
 const kiosk=page.locator('.kiosk-screen select').first();
 await expect(kiosk).toBeVisible();
 await expect.poll(()=>kiosk.evaluate(el=>{
  const style=getComputedStyle(el);
  return [style.color,style.backgroundColor,style.borderTopColor];
 })).toEqual(['rgb(244, 248, 255)','rgb(16, 36, 58)','rgb(97, 125, 153)']);
 await signInDemo(page,'Org');
 await page.goto('./#/org/telepresence');
 await expect(page.locator('.telemetry-strip strong').first()).toBeVisible();
 await expect.poll(()=>page.locator('.telemetry-strip strong').first().evaluate(el=>getComputedStyle(el).color)).toBe('rgb(37, 50, 71)');
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('desktop and mobile visual review captures both themes on key screens',async({page})=>{
 const {mkdir}=await import('node:fs/promises');
 const dir='../feedar-ui-results/screenshots';await mkdir(dir,{recursive:true});
 await page.emulateMedia({colorScheme:'light'});
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844]] as const){
  await page.setViewportSize({width,height});
  await page.goto('./#/login');await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.screenshot({path:`${dir}/login-light-${label}.png`,fullPage:true});
  await page.getByRole('button',{name:'Switch to dark mode'}).click();
  await page.screenshot({path:`${dir}/login-dark-${label}.png`,fullPage:true});
  await page.getByRole('button',{name:'Switch to light mode'}).click();
 }
 await page.setViewportSize({width:1440,height:1000});
 await signInDemo(page,'Boss');
 await page.goto('./#/overview');await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();
 await page.screenshot({path:`${dir}/boss-light-desktop.png`,fullPage:true});
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await page.screenshot({path:`${dir}/boss-dark-desktop.png`,fullPage:true});
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 await page.setViewportSize({width:390,height:844});
 await signInDemo(page,'Org');
 await page.goto('./#/org/status');await expect(page.getByRole('heading',{name:'Robot Status'})).toBeVisible();
 await page.screenshot({path:`${dir}/robot-status-light-mobile.png`,fullPage:true});
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await page.screenshot({path:`${dir}/robot-status-dark-mobile.png`,fullPage:true});
 await page.goto('./#/org/telepresence');
 await expect(page.getByRole('heading',{name:'Remote session'})).toBeVisible();
 await page.screenshot({path:`${dir}/telepresence-dark-mobile.png`,fullPage:true});
 await page.getByRole('button',{name:'Switch to light mode'}).click();
 await page.screenshot({path:`${dir}/telepresence-light-mobile.png`,fullPage:true});
});
