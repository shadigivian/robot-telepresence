import { signInDemo } from './helpers/demo-login';
import { expect, test, type Page } from '@playwright/test';
import type { Database } from '../src/domain/models';

const open = (page:Page,path:string) => page.goto(`./#${path}`);
async function saved(page:Page):Promise<Database>{return page.evaluate(async()=>{const path=new URL('src/app/context.tsx',location.href.split('#')[0]).pathname;const module=await import(path);return module.store.read();});}
async function signOut(page:Page){await page.getByRole('button',{name:'Open profile'}).click();await page.getByRole('dialog',{name:'Demo profile'}).getByRole('button',{name:'Sign out'}).click();await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();}
async function signIn(page:Page,email:string){await page.getByLabel('Email / username').fill(email);await page.getByLabel('Public demo password').fill('123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Demo MFA code').fill('123456');await page.getByRole('button',{name:'Enter workspace'}).click();await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();}
async function accept(page:Page,email:string,name:string){await open(page,'/invitations');await page.getByRole('row').filter({hasText:email}).getByRole('link',{name:'Preview',exact:true}).click();await expect(page.getByRole('heading',{name:'Wrong recipient identity'})).toBeVisible();await page.getByRole('button',{name:'Sign out of current demo identity'}).click();await page.getByLabel('Fictitious recipient display name').fill(name);await page.getByRole('button',{name:'Accept as fictitious recipient'}).click();await page.waitForURL('**/#/settings');}
async function invite(page:Page,email:string,role:'ADMIN'|'USER'){await open(page,'/members');await page.getByRole('button',{name:'Invite member',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Invite member or session participant'});await dialog.getByLabel('Fictitious recipient email').fill(email);if(role==='ADMIN')await dialog.getByLabel('Membership role').selectOption(role);await dialog.getByRole('button',{name:'Create local invitation'}).click();await expect(dialog).not.toBeVisible();}

test('Ali Owner, Admin and User return through local invitations; suspension revokes Admin access',async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');await signInDemo(page,'Boss');
  await open(page,'/organizations');await page.getByRole('button',{name:'Create organization',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Create organization'});
  await form.getByLabel('Organization name',{exact:true}).fill('Feedar Smart Hospital');
  await form.getByLabel('Unique public slug').fill('feedar-smart-hospital');
  await form.getByLabel('City',{exact:true}).fill('Tehran');
  await form.getByLabel('Country',{exact:true}).fill('Iran');
  await form.getByLabel('Owner name').fill('Ali Ahmadi');
  await form.getByLabel('Owner demo email').fill('ali.ahmadi@feedar.example');
  await form.getByLabel('Organization phone number').fill('09123456789');
  await form.getByRole('button',{name:'Create organization & Owner invitation'}).click();
  await page.getByRole('link',{name:'Preview acceptance'}).click();
  await expect(page.getByRole('heading',{name:'Wrong recipient identity'})).toBeVisible();
  await page.getByRole('button',{name:'Sign out of current demo identity'}).click();
  await page.getByLabel('Fictitious recipient display name').fill('Ali Ahmadi');
  await page.getByRole('button',{name:'Accept as fictitious recipient'}).click();
  await expect(page.getByLabel('Organization name',{exact:true})).toHaveValue('Feedar Smart Hospital');
  await page.reload();await expect(page.getByLabel('Organization name',{exact:true})).toHaveValue('Feedar Smart Hospital');
  await signOut(page);await signIn(page,'ali.ahmadi@feedar.example');
  await open(page,'/settings');await expect(page.getByLabel('Organization name',{exact:true})).toHaveValue('Feedar Smart Hospital');
  await invite(page,'admin@feedar-smart.example','ADMIN');await accept(page,'admin@feedar-smart.example','Sara Demo');
  await signOut(page);await signIn(page,'admin@feedar-smart.example');
  await invite(page,'user@feedar-smart.example','USER');await accept(page,'user@feedar-smart.example','Reza Demo');
  await signOut(page);await signIn(page,'user@feedar-smart.example');
  await open(page,'/remote');await expect(page.getByRole('heading',{name:'No assigned robots'})).toBeVisible();
  await open(page,'/robots/robot-7');await expect(page.getByRole('heading',{name:'Access unavailable'})).toBeVisible();
  await signOut(page);await signIn(page,'ali.ahmadi@feedar.example');
  await open(page,'/members');const row=page.getByRole('row').filter({hasText:'Sara Demo'});await row.getByRole('button',{name:'Suspend'}).click();
  await expect(row).toContainText('suspended');
  await signOut(page);await page.getByLabel('Email / username').fill('admin@feedar-smart.example');await page.getByLabel('Public demo password').fill('123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Demo MFA code').fill('123456');await page.getByRole('button',{name:'Enter workspace'}).click();
  await expect(page.getByRole('alert')).toContainText('suspended');
  const db=await saved(page);const org=db.organizations.find(o=>o.slug==='feedar-smart-hospital')!;expect(db.memberships.find(m=>m.userId===db.users.find(u=>u.email==='admin@feedar-smart.example')?.id&&m.organizationId===org.id)?.status).toBe('suspended');
  expect(errors).toEqual([]);
});

test('seven requested viewport profiles keep public and management screens within the viewport',async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];const failed:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',request=>failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  const profiles=[['desktop',1920,1080],['laptop',1440,900],['surface-landscape',1368,912],['surface-portrait',912,1368],['tablet',768,1024],['mobile',390,844],['small-mobile',360,800]] as const;
  await signInDemo(page,'Org');
  for(const [name,width,height] of profiles){
    await page.setViewportSize({width,height});
    for(const [screen,path] of [['welcome','/welcome'],['login','/login'],['kiosk','/robot/robot-7/kiosk']] as const){
      await open(page,path);await expect(page.locator('body')).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`audit-reports/deep-audit/screenshots/${name}-${screen}.png`,fullPage:true});
    }
    await open(page,'/operations');
    await expect(page.getByRole('heading',{name:'Robot operations'})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`audit-reports/deep-audit/screenshots/${name}-operations.png`,fullPage:true});
  }
  expect(errors).toEqual([]);expect(failed).toEqual([]);
});
