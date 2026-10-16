import { expect, type Page } from '@playwright/test';

const identities:Record<string,string>={Boss:'boss@feedar.example',Org:'owner@futurehealth.example',Admin:'admin@futurehealth.example',User:'user@futurehealth.example'};

export async function signInDemo(page:Page,name:string){
 const email=identities[name];if(!email)throw new Error(`Unknown fixture identity: ${name}`);
 await page.goto('./#/login');
 await page.getByLabel('Email / username').fill(email);
 await page.getByLabel('Public demo password').fill('123456');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Demo MFA code').fill('123456');
 await page.getByRole('button',{name:'Enter workspace'}).click();
 await expect(page.getByRole('button',{name:'Open profile'})).toBeVisible();
}
