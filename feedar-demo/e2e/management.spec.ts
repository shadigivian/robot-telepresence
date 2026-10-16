import { signInDemo } from './helpers/demo-login';
import { expect, test, type Page } from '@playwright/test';
import type { Database } from '../src/domain/models';

async function persona(page:Page,name:string){
  await signInDemo(page,name);
  await expect(page.locator('.demo-banner')).toBeVisible();
}
async function openRoute(page:Page,path:string){await page.goto(`./#${path}`);await expect(page.locator('.demo-banner')).toBeVisible();}
async function invite(page:Page,email:string,role:'ADMIN'|'USER',robot?:string){
  await page.getByRole('button',{name:'Invite member',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Fictitious recipient email').fill(email);
  if(role==='ADMIN')await dialog.getByLabel('Membership role').selectOption('ADMIN');
  if(robot)await dialog.getByLabel('Optional assigned robot').selectOption(robot);
  await dialog.getByRole('button',{name:'Create local invitation'}).click();
  await expect(dialog).not.toBeVisible();
}
async function acceptRecipient(page:Page,email:string,name:string){
  await openRoute(page,'/invitations');
  await page.getByRole('row').filter({hasText:email}).getByRole('link',{name:'Preview',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Wrong recipient identity'})).toBeVisible();
  await page.getByRole('button',{name:'Sign out of current demo identity'}).click();
  await page.getByLabel('Fictitious recipient display name').fill(name);
  await page.getByRole('button',{name:'Accept as fictitious recipient'}).click();
  await page.waitForURL('**/#/settings');
}
async function returnAsMember(page:Page,email:string){
  await page.getByRole('button',{name:'Open profile'}).click();
  await page.getByRole('dialog',{name:'Demo profile'}).getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();
  await page.getByLabel('Email / username').fill(email);
  await page.getByLabel('Public demo password').fill('123456');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Demo MFA code').fill('123456');
  await page.getByRole('button',{name:'Enter workspace'}).click();
  await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();
}

test.beforeEach(async({page})=>{await page.goto('./');await expect(page.getByRole('link',{name:'Enter Feedar Cloud'})).toBeVisible();});

test('Boss creates organization and recipient accepts Owner onboarding',async({page})=>{
  await persona(page,'Boss');await openRoute(page,'/organizations');
  await page.getByRole('button',{name:'Create organization',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Organization name',{exact:true}).fill('E2E Clinic');
  await dialog.getByLabel('Unique public slug').fill('e2e-clinic');
  await dialog.getByLabel('City',{exact:true}).fill('Istanbul');
  await dialog.getByLabel('Country',{exact:true}).fill('Türkiye');
  await dialog.getByLabel('Owner name',{exact:true}).fill('Demo Clinic Owner');
  await dialog.getByLabel('Owner demo email').fill('owner@e2eclinic.example');
  await dialog.getByLabel('Organization phone number').fill('09123456789');
  await dialog.getByRole('button',{name:'Create organization & Owner invitation'}).click();
  await expect(page.getByRole('heading',{name:'E2E Clinic',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Preview acceptance'}).click();
  await page.getByRole('button',{name:'Sign out of current demo identity'}).click();
  await page.getByLabel('Fictitious recipient display name').fill('Demo Clinic Owner');
  await page.getByRole('button',{name:'Accept as fictitious recipient'}).click();
  await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
  await expect(page.getByLabel('Organization name',{exact:true})).toHaveValue('E2E Clinic');
  await expect(page.getByRole('link',{name:'Organizations',exact:true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Organization name',{exact:true})).toHaveValue('E2E Clinic');
  await returnAsMember(page,'owner@e2eclinic.example');
  await openRoute(page,'/settings');
  await expect(page.getByLabel('Organization name',{exact:true})).toHaveValue('E2E Clinic');
  await openRoute(page,'/organizations/org-airport');
  await expect(page.getByRole('heading',{name:'Organization unavailable'})).toBeVisible();
});

test('Owner invites Admin; Admin cannot mutate existing Admin rows or invite privileged roles',async({page})=>{
  await persona(page,'Org');await openRoute(page,'/members');
  await invite(page,'new.admin@futurehealth.example','ADMIN');
  await acceptRecipient(page,'new.admin@futurehealth.example','Demo New Admin');
  await returnAsMember(page,'new.admin@futurehealth.example');
  await openRoute(page,'/members');
  const existingAdmin=page.getByRole('row').filter({hasText:'Sara Williams'});
  await expect(existingAdmin).toContainText('View only');
  await expect(existingAdmin.getByRole('button',{name:'Edit',exact:true})).toHaveCount(0);
  const owner=page.getByRole('row').filter({hasText:'Dr. Maya Chen'});
  await expect(owner.getByRole('button',{name:'Remove',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Invite member',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Membership role')).toBeDisabled();
  await expect(page.getByRole('dialog').getByLabel('Membership role').locator('option')).toHaveCount(1);
});

test('Admin invites User assigned Nola; User cannot open another tenant robot',async({page})=>{
  await persona(page,'Admin');await openRoute(page,'/members');
  await invite(page,'new.user@futurehealth.example','USER','robot-7');
  await acceptRecipient(page,'new.user@futurehealth.example','Demo Assigned User');
  await returnAsMember(page,'new.user@futurehealth.example');
  await openRoute(page,'/remote');
  await expect(page.getByRole('heading',{name:/^Nola/})).toBeVisible();
  await expect(page.getByRole('link',{name:'Members',exact:true})).toHaveCount(0);
  await page.goto('./#/robots/robot-8');
  await expect(page.getByRole('heading',{name:'Access unavailable'})).toBeVisible();
  await page.goto('./#/remote?robot=robot-8');
  await expect(page.getByRole('heading',{name:'Remote session',exact:true})).toBeVisible();
  await expect(page.getByRole('option',{name:/Mira/})).toHaveCount(0);
});

test('POI and branding changes persist and reset restores deterministic fixtures',async({page})=>{
  await persona(page,'Org');await openRoute(page,'/maps');
  await page.getByRole('button',{name:'Add point',exact:true}).click();
  const point=page.getByRole('dialog');
  await point.getByLabel('Location label').fill('Demo Quiet Room');
  await point.getByLabel('Category').selectOption('room');
  await point.getByRole('button',{name:'Save point'}).click();
  await expect(page.getByRole('button',{name:/Demo Quiet Room/}).first()).toBeVisible();
  await openRoute(page,'/settings');
  await page.getByLabel('Robot welcome text').fill('Welcome to the local E2E demonstration.');
  await page.getByRole('button',{name:'Save organization settings'}).click();
  await expect(page.getByRole('status').filter({hasText:'Saved. Workspace'})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Robot welcome text')).toHaveValue('Welcome to the local E2E demonstration.');
  await page.goto('./#/o/future-health');
  await expect(page.getByText('Welcome to the local E2E demonstration.',{exact:true})).toBeVisible();
  await openRoute(page,'/maps');
  await expect(page.getByRole('button',{name:/Demo Quiet Room/}).first()).toBeVisible();
  await openRoute(page,'/settings');
  await page.getByRole('button',{name:'Reset demo data',exact:true}).click();
  const reset=page.getByRole('dialog');
  await expect(reset.getByRole('button',{name:'Confirm reset'})).toBeDisabled();
  await reset.getByLabel('Type RESET to confirm').fill('RESET');
  await reset.getByRole('button',{name:'Confirm reset'}).click();
  await expect(reset).not.toBeVisible();
  await expect(page.getByLabel('Robot welcome text')).toHaveValue('Hello! How can I help you today?');
  await openRoute(page,'/maps');
  await expect(page.getByRole('button',{name:/Demo Quiet Room/})).toHaveCount(0);
});

test('Unknown invitation and public seeded tour are honest in a fresh browser',async({page})=>{
  await page.goto('./#/join/not-a-shared-record');
  await expect(page.getByRole('heading',{name:'Demo invitation record unavailable'})).toBeVisible();
  await expect(page.getByText(/another browser is not shared/)).toBeVisible();
  await page.getByRole('link',{name:'Explore a fresh-browser public tour'}).click();
  await expect(page.getByRole('heading',{name:'Future Health Hospital',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Open public kiosk'}).first().click();
  await expect(page.getByRole('heading',{name:/How can I help you today/})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Workspace navigation'})).toHaveCount(0);
});

test('Profile drafts survive simulator ticks and save their values',async({page})=>{
  await persona(page,'Org');await openRoute(page,'/settings');
  const city=page.getByLabel('City',{exact:true});
  await city.fill('Demo Draft City');
  // Cover several scheduled 200 ms datastore ticks without changing the organization revision.
  await page.waitForTimeout(700);
  await expect(city).toHaveValue('Demo Draft City');
  await page.getByRole('button',{name:'Save profile details'}).click();
  await expect.poll(async()=>page.evaluate(async()=>{const path=new URL('src/app/context.tsx',window.location.href.split('#')[0]).pathname;const module=await import(path);const db=await module.store.read() as Database;return db.organizations.find(o=>o.id==='org-hospital')?.city;})).toBe('Demo Draft City');
  await page.reload();
  await expect(page.getByLabel('City',{exact:true})).toHaveValue('Demo Draft City');
});

test('Admin cannot resolve another tenant organization route or open Knowledge',async({page})=>{
  await persona(page,'Admin');await openRoute(page,'/organization/org-hospital');
  await expect(page.getByRole('heading',{name:'Future Health Hospital',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Knowledge',exact:true})).toHaveCount(0);
  await openRoute(page,'/organization/org-airport');
  await expect(page.getByRole('heading',{name:'Organization unavailable',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Future Health Hospital',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Atlas Airport Services',exact:true})).toHaveCount(0);
});
