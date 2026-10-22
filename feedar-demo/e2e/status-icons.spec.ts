import {expect,test,type Locator,type Page} from '@playwright/test';
import {signInDemo} from './helpers/demo-login';
import type {Database} from '../src/domain/models';

const row=(page:Page,device='FD-HSP-0007')=>page.getByRole('row').filter({hasText:device});
const glyph=(scope:Page|Locator,id:string)=>scope.locator(`svg[data-asset-id="${id}"]`);
const tooltip=(page:Page)=>page.getByRole('tooltip');
const trigger=(scope:Page|Locator)=>scope.locator('button.status-tooltip-trigger').first();

async function iconOnly(button:Locator){
 await expect(button).toBeVisible();
 await expect(button.locator('svg')).toHaveCount(1);
 await expect(button.locator('svg')).toHaveAttribute('aria-hidden','true');
 const content=await button.evaluate(element=>{
  const label=element.querySelector<HTMLElement>('.status-tooltip-label');
  const style=label?getComputedStyle(label):null,box=label?.getBoundingClientRect();
  const text=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),visible:string[]=[];
  let node:Node|null;
  while((node=text.nextNode()))if(node.textContent?.trim()&&!node.parentElement?.closest('.status-tooltip-label'))visible.push(node.textContent.trim());
  return{hasLabel:!!label,clipped:!!box&&box.width<=1&&box.height<=1&&style?.position==='absolute',visible};
 });
 expect(content).toEqual({hasLabel:true,clipped:true,visible:[]});
}

async function tooltipInsideViewport(page:Page){
 await expect(tooltip(page)).toBeVisible();
 expect(await tooltip(page).evaluate(element=>{const r=element.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})).toBe(true);
}

test('Boss monitoring uses distinct real Activity glyphs and accessible icon-only status tooltips in both themes',async({page})=>{
 await signInDemo(page,'Boss');
 await page.evaluate(async()=>{
  const module=await import(new URL('src/app/context.tsx',location.href.split('#')[0]).pathname);
  await module.store.transaction((db:Database)=>{
   const now=Date.now(),robot=db.robots.find(r=>r.id==='robot-7')!,missionRobot=db.robots.find(r=>r.id==='robot-8')!;
   db.sessions.push({id:'tooltip-live-session',createdAt:now,updatedAt:now,revision:1,organizationId:robot.organizationId,robotId:robot.id,userId:'user',status:'connected',capabilities:['video','chat'],expiresAt:now+1800000,participantIds:['user']});
   const point=db.points.find(p=>p.organizationId===missionRobot.organizationId&&p.name==='Radiology')!;
   db.missions.push({id:'tooltip-running-mission',createdAt:now,updatedAt:now,revision:1,organizationId:missionRobot.organizationId,robotId:missionRobot.id,pointId:point.id,status:'running',eta:Math.ceil(Math.hypot(point.x-missionRobot.x,point.y-missionRobot.y)/2.5),actorId:'owner-1'});
  });
 });
 await page.goto('./#/robot-monitoring');
 const telepresence=row(page),mission=row(page,'FD-APT-0008'),idle=row(page,'FD-CNV-0009');
 await expect(glyph(telepresence,'FDR-ACTIVITY-TELEPRESENCE')).toBeVisible();
 await expect(glyph(mission,'FDR-ACTIVITY-MISSION')).toBeVisible();
 await expect(glyph(idle,'FDR-ACTIVITY-IDLE')).toBeVisible();
 await expect(glyph(telepresence,'FDR-CURRENT-CONNECTED-USER')).toBeVisible();
 await expect(telepresence).toContainText('No active user');
 for(const theme of ['light','dark']as const){
  const root=page.locator('html');
  if(await root.getAttribute('data-theme')!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`}).click();
  const percentages=page.locator('.feedar-monitoring-assets [data-status="battery"] .status-value');
  expect(await percentages.count()).toBeGreaterThan(0);
  const values=await percentages.evaluateAll(elements=>elements.map(element=>{const range=document.createRange();range.selectNodeContents(element);return{text:element.textContent,rects:[...range.getClientRects()].map(rect=>({top:rect.top,bottom:rect.bottom,width:rect.width}))};}));
  for(const value of values){
   expect(value.text).toMatch(/^\d+%$/);
   expect(value.rects.length).toBeGreaterThan(0);
   for(const rect of value.rects){expect(rect.width).toBeGreaterThan(0);expect(rect.top).toBeCloseTo(value.rects[0].top,1);expect(rect.bottom).toBeCloseTo(value.rects[0].bottom,1);}
  }
  const connection=telepresence.getByRole('button',{name:'Online',exact:true});
  await iconOnly(connection);
  await connection.hover();
  await expect(tooltip(page)).toHaveText('Online');
  await tooltipInsideViewport(page);
  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  await connection.focus();
  await expect(tooltip(page)).toHaveText('Online');
  await page.keyboard.press('Escape');
  await expect(tooltip(page)).toHaveCount(0);
  const absent=telepresence.getByRole('button',{name:'No active user',exact:true});
  await iconOnly(absent);
  await absent.focus();
  await expect(tooltip(page)).toHaveText('No active user');
  await test.info().attach(`boss-current-tooltip-${theme}`,{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:834,height:1112});
 const status=telepresence.getByRole('button',{name:'Available',exact:true});
 await status.scrollIntoViewIfNeeded();
 await status.focus();
 await tooltipInsideViewport(page);
 const wrap=page.locator('.feedar-monitoring-assets');
 expect(await wrap.evaluate(element=>element.scrollWidth>element.clientWidth)).toBe(true);
 await wrap.evaluate(element=>{element.scrollLeft+=element.scrollLeft>0?-16:16;});
 await tooltipInsideViewport(page);
 expect(await tooltip(page).evaluate(element=>element.closest('.table-wrap')===null)).toBe(true);
});

test('organization and User views preserve identities, battery and control actions while hiding duplicate status captions',async({page,context})=>{
 await signInDemo(page,'User');
 await page.getByRole('button',{name:'Request session',exact:true}).click();
 await page.getByRole('button',{name:'Join demo session',exact:true}).click();
 await page.getByRole('button',{name:'Request control',exact:true}).click();
 const owner=await context.newPage();
 await signInDemo(owner,'Org');
 await owner.goto('./#/org/telepresence');
 await owner.getByRole('button',{name:'Approve control',exact:true}).click();
 await owner.goto('./#/org/status');
 const robot=row(owner);
 await expect(robot.locator('[data-label="Current Connected User"] .status-value')).toHaveText('Daniel Foster');
 await expect(robot.locator('[data-label="Battery"] .status-value')).toHaveText('87%');
 await expect(glyph(robot,'FDR-CURRENT-CONNECTED-USER')).toBeVisible();
 await expect(glyph(robot,'FDR-ACTIVITY-TELEPRESENCE')).toBeVisible();
 await iconOnly(robot.locator('[data-label="Availability"]').getByRole('button',{name:'Busy',exact:true}));
 await expect(robot.getByRole('link',{name:'Connect to Robot'})).toHaveCount(0);
 await page.getByRole('button',{name:'Release control',exact:true}).click();
 await expect(robot.locator('[data-label="Current Connected User"] .status-value')).toHaveCount(0);
 await expect(robot.locator('[data-label="Last Connected User"] .status-value')).toHaveText('Daniel Foster');
 await iconOnly(robot.getByRole('button',{name:'No active user',exact:true}));
 await expect(glyph(robot.locator('[data-label="Current Connected User"]'),'FDR-CURRENT-CONNECTED-USER')).toHaveCount(1);
 await expect(glyph(robot.locator('[data-label="Current Connected User"]'),'FDR-ACTIVITY-IDLE')).toHaveCount(0);
 await page.getByRole('button',{name:'End call',exact:true}).click();
 await page.goto('./#/org/status');
 await expect(glyph(row(page),'FDR-ACTIVITY-IDLE')).toBeVisible();
 await expect(row(page).locator('[data-label="Battery"] .status-value')).toHaveText('87%');
 await iconOnly(row(page).getByRole('button',{name:'Available',exact:true}));
});

test('Fleet row actions remain usable and status tooltips are painted above native detail dialogs',async({page})=>{
 await signInDemo(page,'Org');
 await page.evaluate(async()=>{const module=await import(new URL('src/app/context.tsx',location.href.split('#')[0]).pathname);await module.store.transaction((db:Database)=>{const now=Date.now();db.sessions.push({id:'tooltip-history-session',createdAt:now-120000,updatedAt:now,revision:1,organizationId:'org-hospital',robotId:'robot-7',userId:'user',status:'ended',capabilities:['video','chat'],expiresAt:now-60000,participantIds:['user']});});});
 await page.goto('./#/operations');
 const mini=page.locator('button.robot-mini').first();
 await expect(mini.locator('button')).toHaveCount(0);
 await expect(glyph(mini,'FDR-ROBOT-ONLINE')).toBeVisible();
 await mini.focus();
 await expect(tooltip(page)).toHaveCount(1);
 await expect(tooltip(page)).toBeVisible();
 await expect(tooltip(page)).toContainText('Online');
 await expect(tooltip(page)).toContainText('Battery: 87%');
 await page.evaluate(async()=>{const module=await import(new URL('src/app/context.tsx',location.href.split('#')[0]).pathname);await module.store.transaction((db:Database)=>{db.robots.find(robot=>robot.id==='robot-7')!.fault='Synthetic tooltip fault';});});
 await expect(tooltip(page)).toContainText('Fault: Synthetic tooltip fault');
 await page.evaluate(async()=>{const module=await import(new URL('src/app/context.tsx',location.href.split('#')[0]).pathname);await module.store.transaction((db:Database)=>{db.robots.find(robot=>robot.id==='robot-7')!.fault=null;});});
 await expect(tooltip(page)).not.toContainText('Synthetic tooltip fault');
 await page.keyboard.press('Escape');
 await mini.click();
 const details=page.getByRole('dialog');
 await expect(details).toBeVisible();
 await details.getByRole('tab',{name:'history',exact:true}).click();
 const history=details.getByRole('button',{name:'Session: ended',exact:true});
 await iconOnly(history);
 await expect(details).toContainText('Daniel Foster');
 await history.focus();
 await expect(tooltip(page)).toHaveText('Session: ended');
 await test.info().attach('fleet-session-history-tooltip',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 await page.keyboard.press('Escape');
 const connection=details.getByRole('button',{name:'Online',exact:true}).first();
 await iconOnly(connection);
 await connection.focus();
 await expect(tooltip(page)).toHaveText('Online');
 await tooltipInsideViewport(page);
 await expect(details.getByRole('tooltip')).toHaveCount(1);
 expect(await tooltip(page).evaluate(element=>{const r=element.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return top===element||!!top&&element.contains(top);})).toBe(true);
 await test.info().attach('fleet-dialog-tooltip',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
 await page.keyboard.press('Escape');
 await expect(tooltip(page)).toHaveCount(0);
 await expect(details).toBeVisible();
 await details.getByRole('button',{name:'Close dialog',exact:true}).click();
 await expect(details).toHaveCount(0);
 const inventory=row(page);
 await iconOnly(inventory.getByRole('button',{name:'Online',exact:true}));
 await inventory.getByRole('button',{name:'Details',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.goto('./#/o/future-health');
 const guide=page.locator('.list-row').filter({has:page.locator('strong').filter({hasText:/^Nola \//})});
 await expect(guide).toHaveCount(1);
 await iconOnly(guide.getByRole('button',{name:'Online',exact:true}));
 await expect(guide).toContainText('Simulated robot');
});

test('support rows keep existing status meanings and new/Open alias as icon-only tooltips without removing ticket content',async({page})=>{
 await signInDemo(page,'Boss');
 await page.evaluate(async()=>{
  const module=await import(new URL('src/app/context.tsx',location.href.split('#')[0]).pathname);
  await module.store.transaction((db:Database)=>{
   const now=Date.now();
   db.tickets=(['open','new','in_review','awaiting_reply','resolved','closed']as const).map((status,index)=>({id:`tooltip-ticket-${status}`,createdAt:now+index,updatedAt:now+index,revision:1,organizationId:'org-hospital',userId:'user',robotId:'robot-7',subject:`Tooltip fixture ${status}`,text:'Fictional support content remains visible.',status,category:'technical',priority:'normal',replies:[],creatorRole:'USER'}));
  });
 });
 await page.goto('./#/boss/support');
 const states={open:/^open$/i,new:/^open$/i,in_review:/^In Progress$/,awaiting_reply:/^Waiting for User$/,resolved:/^resolved$/i,closed:/^closed$/i};
 for(const[status,label]of Object.entries(states)){
  const ticket=page.getByRole('row').filter({hasText:`Tooltip fixture ${status}`}),cell=ticket.locator('td').nth(6),button=cell.getByRole('button',{name:'Explain ticket state',exact:true});
  await iconOnly(button);
  await expect(button).toHaveAccessibleDescription(label);
  await expect(glyph(cell,'FDR-TICKET-STATUS-BADGE')).toHaveAttribute('data-ticket-state',status==='new'?'open':status);
  await button.focus();
  await expect(tooltip(page)).toHaveText(label);
  await page.keyboard.press('Escape');
 }
 await expect(page.getByRole('row').filter({hasText:'Tooltip fixture open'}).getByRole('button',{name:'Open'})).toHaveCount(1);
 await page.getByRole('row').filter({hasText:'Tooltip fixture open'}).locator('td').last().getByRole('button',{name:'Open',exact:true}).click();
 await expect(page.getByText('Fictional support content remains visible.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Ticket status')).toBeEnabled();
 await expect(page.getByRole('button',{name:'Resolve',exact:true})).toBeVisible();
 await signInDemo(page,'Org');
 await page.goto('./#/org/billing-support');
 await expect(glyph(page,'FDR-TICKET-STATUS-BADGE').first()).toBeVisible();
 await iconOnly(trigger(page.getByRole('row').filter({hasText:'Tooltip fixture open'})));
});

test('mobile User can tap and dismiss status information without document overflow',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await context.newPage();
 try{
  await signInDemo(page,'User');
  await page.goto('./#/org/status');
  const robot=row(page),connection=robot.getByRole('button',{name:'Online',exact:true});
  await connection.scrollIntoViewIfNeeded();
  await connection.tap();
  await expect(tooltip(page)).toHaveText('Online');
  await tooltipInsideViewport(page);
  await page.getByRole('heading',{name:'Robot Status',exact:true}).tap();
  await expect(tooltip(page)).toHaveCount(0);
  const absent=robot.getByRole('button',{name:'No active user',exact:true});
  await absent.scrollIntoViewIfNeeded();
  await absent.tap();
  await expect(tooltip(page)).toHaveText('No active user');
  await tooltipInsideViewport(page);
  await test.info().attach('mobile-current-tooltip',{body:await page.screenshot({animations:'disabled'}),contentType:'image/png'});
  await absent.tap();
  await expect(tooltip(page)).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}
});
