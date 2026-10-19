import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/demo-login';

const sizes=[
 ['desktop',1920,1080],['laptop',1440,900],['surface-landscape',1368,912],
 ['surface-portrait',912,1368],['tablet',768,1024],['mobile',390,844],['small-mobile',360,800],
] as const;

test('warm Login surfaces work at seven sizes and Dark Mode retains its palette',async({page})=>{
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
 for(const [,width,height] of sizes){
  await page.setViewportSize({width,height});
  await page.goto('./#/login');
  await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();
  await expect(page.locator('.login-card')).toHaveCSS('background-color','rgb(250, 248, 245)');
  await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--background').trim())).toBe('#f3f0eb');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await expect(page.locator('aside.demo-switcher,.demo-accounts')).toHaveCount(0);
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--background').trim())).toBe('#07111f');
 await expect(page.locator('.login-card')).toHaveCSS('background-image',/linear-gradient/);
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(errors).toEqual([]);
});

test('Login validates input, toggles password, accepts Enter and MFA, persists, then signs out',async({page})=>{
 await page.goto('./#/login');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Enter a demo email or username.'})).toBeVisible();
 await expect(page.getByRole('alert').filter({hasText:'Enter the public demo password.'})).toBeVisible();
 await page.getByLabel('Email / username').fill('not-an-email');
 await page.getByLabel('Public demo password').fill('bad');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Use a fictitious .example email'})).toBeVisible();
 await page.getByLabel('Email / username').fill('boss@feedar.example');
 const password=page.getByLabel('Public demo password');
 await password.fill('wrong');
 await page.getByRole('button',{name:'Show password'}).click();
 await expect(password).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Hide password'}).click();
 await expect(password).toHaveAttribute('type','password');
 await password.press('Enter');
 await expect(page.getByRole('alert').filter({hasText:'does not match'})).toBeVisible();
 await password.fill('123456');
 await password.press('Enter');
 await expect(page.getByRole('heading',{name:'Demo verification'})).toBeVisible();
 await page.getByLabel('Demo MFA code').fill('000000');
 await page.getByRole('button',{name:'Enter workspace'}).click();
 await expect(page.getByRole('alert').filter({hasText:'MFA code'})).toBeVisible();
 await page.getByLabel('Demo MFA code').fill('123456');
 await page.getByRole('button',{name:'Enter workspace'}).click();
 await expect(page).toHaveURL(/#\/overview$/);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Good morning, Boss'})).toBeVisible();
 await page.getByRole('button',{name:'Open profile'}).click();
 await page.getByRole('button',{name:'Sign out'}).click();
 await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();
});

for(const role of ['Boss','Org','Admin','User'] as const){
 test(`${role} demo identity opens its permitted workspace`,async({page})=>{
  await signInDemo(page,role);
  await expect(page).toHaveURL(role==='User'?/#\/remote$/:/#\/overview$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme',/light|dark/);
 });
}
