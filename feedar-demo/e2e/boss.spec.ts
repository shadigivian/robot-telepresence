import { signInDemo } from './helpers/demo-login';
import { expect, test, type Page } from '@playwright/test';
import type { Database } from '../src/domain/models';

const open=(page:Page,path:string)=>page.goto(`./#${path}`);
async function saved(page:Page):Promise<Database>{return page.evaluate(async()=>{const path=new URL('src/app/context.tsx',location.href.split('#')[0]).pathname;const module=await import(path);return module.store.read();});}
async function boss(page:Page){await signInDemo(page,'Boss');}

test('Boss creates complete organization, enters its real workspace, credits it, and returns with tenant isolation',async({page})=>{
  test.setTimeout(90000);await boss(page);await open(page,'/organizations');await page.getByRole('button',{name:'Create organization',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Create organization'});
  await dialog.getByLabel('Organization name',{exact:true}).fill('Boss Clinic');await dialog.getByLabel('Unique public slug').fill('boss-clinic');
  await dialog.getByLabel('City',{exact:true}).fill('Tehran');await dialog.getByLabel('Country',{exact:true}).fill('Iran');
  await dialog.getByLabel('Owner name').fill('Ali Ahmadi');await dialog.getByLabel('Owner demo email').fill('ali@boss-clinic.example');
  await dialog.getByLabel('Organization phone country code').selectOption('IR');await dialog.getByLabel('Organization phone number').fill('1234');
  await dialog.getByRole('button',{name:'Create organization & Owner invitation'}).click();await expect(dialog.getByRole('alert').filter({hasText:'phone'})).toBeVisible();
  await dialog.getByLabel('Organization phone number').fill('09123456789');
  await dialog.getByRole('button',{name:'Create organization & Owner invitation'}).click();await expect(page.getByRole('heading',{name:'Boss Clinic',exact:true})).toBeVisible();
  let db=await saved(page);const org=db.organizations.find(o=>o.slug==='boss-clinic')!;expect(org.contactPhone).toBe('+989123456789');expect(db.invitations.find(i=>i.organizationId===org.id&&i.role==='OWNER')?.status).toBe('pending');
  await page.getByRole('button',{name:'Enter Organization Panel'}).click();await expect(page.locator('.support-banner')).toContainText('Boss managing Boss Clinic');
  await open(page,'/settings');await page.getByLabel('Organization name',{exact:true}).fill('Boss Clinic Updated');await page.getByRole('button',{name:'Save organization settings'}).click();
  await expect.poll(async()=>(await saved(page)).organizations.find(o=>o.id===org.id)?.name).toBe('Boss Clinic Updated');
  db=await saved(page);expect([...db.audits].reverse().find(a=>a.action==='organization.update'&&a.entityId===org.id)?.actorId).toBe('boss');expect(db.organizations.find(o=>o.id==='org-airport')?.name).toBe('Atlas Airport Services');
  await page.getByRole('button',{name:'Back to Boss'}).click();await expect(page.getByRole('heading',{name:'Good morning, Boss'})).toBeVisible();await expect(page.locator('.support-banner')).toHaveCount(0);
  await open(page,`/organization/${org.id}`);await page.getByLabel('Demo credit amount').fill('100');await page.getByRole('button',{name:'Add demo credit'}).click();
  await expect(page.getByRole('table').filter({hasText:'topup'})).toBeVisible();expect((await saved(page)).creditEntries.filter(e=>e.organizationId===org.id)).toHaveLength(1);
  await page.reload();await expect(page.getByText('Demo credit balance')).toBeVisible();await expect(page.getByText('100',{exact:true}).first()).toBeVisible();
  await open(page,'/organizations');const airport=page.locator('.organization-card').filter({hasText:'Atlas Airport Services'});await airport.getByRole('button',{name:'Enter Organization Panel'}).click();await expect(page.locator('.support-banner')).toContainText('Atlas Airport Services');
  expect((await saved(page)).creditEntries.filter(e=>e.organizationId==='org-airport')).toHaveLength(0);
});

test('Boss registers an unassigned identifier and Owner pairs, tests, and activates it',async({page})=>{
  test.setTimeout(90000);await boss(page);await open(page,'/robot-management');
  await page.getByLabel('Unique robot identifier').fill('FD-DEMO-0040');await page.getByLabel('Robot name',{exact:true}).fill('Clinic Helper');await page.getByLabel('Model').fill('Feedar One');
  await page.getByRole('button',{name:'Register unassigned robot'}).click();
  let db=await saved(page);expect(db.registeredRobots.find(r=>r.identifier==='FD-DEMO-0040')?.organizationId).toBeUndefined();expect(db.robots.some(r=>r.deviceId==='FD-DEMO-0040')).toBe(false);
  await signInDemo(page,'Org');await open(page,'/operations');await page.getByRole('button',{name:'Add robot'}).click();const dialog=page.getByRole('dialog',{name:'Add a demo robot'});
  await dialog.getByRole('button',{name:'Next'}).click();await dialog.getByLabel('Serial / fleet label').fill('R-40');await dialog.getByLabel('Boss-registered device identifier').fill('FD-DEMO-0040');
  await dialog.getByRole('button',{name:'Create demo device'}).click();db=await saved(page);const robot=db.robots.find(r=>r.deviceId==='FD-DEMO-0040')!;expect(robot.organizationId).toBe('org-hospital');
  await dialog.getByLabel('Enter code shown above').fill(robot.pairingCode!);await dialog.getByRole('button',{name:'Pair demo device'}).click();await dialog.getByRole('button',{name:'Continue to test'}).click();
  await dialog.getByRole('button',{name:'Run connection test'}).click();await dialog.getByRole('button',{name:'Continue to assignments'}).click();await dialog.getByRole('button',{name:'Save assignments'}).click();await dialog.getByRole('button',{name:'Activate robot'}).click();
  await expect(dialog).not.toBeVisible();db=await saved(page);expect(db.robots.find(r=>r.id===robot.id)?.connectivity).toBe('online');expect(db.registeredRobots.find(r=>r.identifier==='FD-DEMO-0040')?.organizationId).toBe('org-hospital');
  await signInDemo(page,'Boss');await open(page,'/robot-monitoring');await page.getByLabel('Search robots').fill('FD-DEMO-0040');await expect(page.getByRole('row').filter({hasText:'Clinic Helper'})).toContainText('online');
});
