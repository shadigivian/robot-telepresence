import { expect, test } from '@playwright/test';
import { signInDemo } from './helpers/demo-login';

test('development pages contain no demo switcher or sample account choices',async({page})=>{
 await page.goto('./#/login');
 await expect(page.getByRole('heading',{name:'Demo member sign in'})).toBeVisible();
 await expect(page.locator('aside.demo-switcher,.demo-accounts')).toHaveCount(0);
 await expect(page.getByText('Demo preview')).toHaveCount(0);
 await expect(page.getByText('Use a demo account')).toHaveCount(0);
 for(const name of ['Boss','Org','Admin','User']){
  await signInDemo(page,name);
  await expect(page.locator('aside.demo-switcher,.demo-accounts')).toHaveCount(0);
  await expect(page.getByText('Demo preview')).toHaveCount(0);
 }
});
