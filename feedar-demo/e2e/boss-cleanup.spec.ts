import { signInDemo } from './helpers/demo-login';
import {expect,test} from '@playwright/test';

const nav=(page:import('@playwright/test').Page)=>page.getByRole('navigation',{name:'Workspace navigation'}).getByRole('link');
const open=(page:import('@playwright/test').Page,path:string)=>page.goto(`./#${path}`);

test('platform Boss exposes six approved sections and scoped Boss retains organization tools',async({page})=>{
  await page.goto('./');await signInDemo(page,'Boss');
  await expect(nav(page)).toHaveText(['Overview','Organizations','Robot Management','Robot Monitoring','Support / Tickets','Settings']);
  await expect(page.locator('.stat')).toHaveCount(6);
  for(const label of ['Registered organizations','Registered robots','Online robots','Offline robots','Activated robots','Robots working'])await expect(page.locator('.stat').filter({hasText:label})).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Recently created organizations'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Service health'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Recent activity'})).toHaveCount(0);
  await open(page,'/settings');await expect(page.getByRole('heading',{name:'No Boss settings yet'})).toBeVisible();await expect(page.getByRole('button',{name:'Reset demo data'})).toHaveCount(0);
  await open(page,'/operations');await expect(page.getByRole('heading',{name:'Organization workspace required'})).toBeVisible();
  await open(page,'/organizations');await page.getByRole('button',{name:'Create organization',exact:true}).click();const form=page.getByRole('dialog',{name:'Create organization'});
  for(const field of ['Organization name','Unique public slug','Industry','Timezone','City','Country','Demo contact email','Organization phone country code','Organization phone number','Robot welcome / assistant language','Owner name','Owner demo email','Description'])await expect(form.getByText(field,{exact:true})).toHaveCount(1);
  await expect(form.getByLabel(/Organization logo/)).toHaveCount(0);await expect(form.getByText('Demo quotas')).toHaveCount(0);
  await form.getByRole('button',{name:'Cancel'}).click();
  await page.locator('.organization-card').first().getByRole('button',{name:'Enter Organization Panel'}).click();await expect(page.locator('.support-banner')).toContainText('Boss managing');await expect(nav(page).count()).resolves.toBeGreaterThan(5);
  await open(page,'/settings');await expect(page.getByLabel('Organization name',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to Boss'}).click();await expect(nav(page)).toHaveText(['Overview','Organizations','Robot Management','Robot Monitoring','Support / Tickets','Settings']);
});

test('Boss monitoring filters remain functional and robot links lead to registry details',async({page})=>{
  await page.goto('./');await signInDemo(page,'Boss');
  await open(page,'/robot-monitoring');
  await page.locator('.toolbar select').nth(0).selectOption('org-hospital');
  await expect(page.getByRole('row').filter({hasText:'FD-HSP-0007'})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'Aria'})).toHaveCount(0);
  await page.locator('.toolbar select').nth(1).selectOption('offline');
  await expect(page.getByRole('row').filter({hasText:'FD-HSP-0007'})).toHaveCount(0);
  await page.locator('.toolbar select').nth(1).selectOption('all');
  await page.getByLabel('Low battery only').check();
  await expect(page.getByRole('row').filter({hasText:'Nola service'})).toBeVisible();
  await page.locator('.toolbar select').nth(2).selectOption('oldest');
  await page.getByRole('link',{name:'Nola service'}).click();
  await expect(page.getByRole('heading',{name:'Robot Management'})).toBeVisible();
  await expect(page.getByLabel('Search registry')).toHaveValue('FD-HSP-0011');
  await expect(page.getByRole('row').filter({hasText:'Nola service'})).toBeVisible();
  await page.getByRole('row').filter({hasText:'Nola service'}).getByRole('button',{name:'Details'}).click();
  await expect(page.getByRole('dialog',{name:'Registered robot details'})).toContainText('Future Health Hospital');
});
