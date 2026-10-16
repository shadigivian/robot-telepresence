import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it} from 'vitest';
import {BrowserStore} from '../services/demo/store';
import {DemoService} from '../services/demo/service';
import {robotControlStatus} from '../domain/robot-status';

const user={userId:'user',organizationId:'org-hospital'},admin={userId:'admin',organizationId:'org-hospital'},now=1_000_000;
const stores:BrowserStore[]=[];let counter=0;
async function setup(){const store=new BrowserStore(`robot-status-${++counter}`,()=>now);stores.push(store);await store.read();return{store,service:new DemoService(store,()=>now)};}
afterEach(async()=>{for(const store of stores.splice(0))await store.close();});
async function request(service:DemoService,actor=user){const session=(await service.execute(actor,'session.create',{robotId:'robot-7'}))!;await service.execute(actor,'session.join',{sessionId:session});const grant=(await service.execute(actor,'control.request',{sessionId:session}))!;return{session,grant};}
async function status(store:BrowserStore,time=now){const db=await store.read();return robotControlStatus(db,db.robots.find(r=>r.id==='robot-7')!,time);}

describe('derived organization robot status',()=>{
 it('does not treat waiting sessions or pending requests as a controller',async()=>{const{store,service}=await setup();const created=(await service.execute(user,'session.create',{robotId:'robot-7'}))!;expect((await status(store)).currentUserId).toBeUndefined();await service.execute(user,'session.join',{sessionId:created});await service.execute(user,'control.request',{sessionId:created});expect((await status(store)).availability).toBe('Available');expect((await status(store)).currentUserId).toBeUndefined();expect((await status(store)).lastUserId).toBeUndefined();});
 it('shows only the granted controller, then moves them to history on release and end',async()=>{const{store,service}=await setup();const first=await request(service);await service.execute(admin,'control.approve',{grantId:first.grant});expect((await status(store)).currentUserId).toBe('user');expect((await status(store)).availability).toBe('Busy');expect((await status(store)).activity).toBe('Working · telepresence');await service.execute(user,'control.release',{grantId:first.grant});expect((await status(store)).currentUserId).toBeUndefined();expect((await status(store)).lastUserId).toBe('user');expect((await status(store)).availability).toBe('Available');await service.execute(user,'session.end',{sessionId:first.session});expect((await status(store)).lastUserId).toBe('user');});
 it('rejects a rival controller and ignores pending cancellation while another lease is valid',async()=>{const{store,service}=await setup();const first=await request(service);await service.execute(admin,'control.approve',{grantId:first.grant});const second=await request(service,admin);await expect(service.execute(admin,'control.approve',{grantId:second.grant})).rejects.toThrow(/Another operator/);await service.execute(admin,'control.release',{grantId:second.grant});expect((await status(store)).currentUserId).toBe('user');expect((await status(store)).availability).toBe('Busy');});
 it('expires the displayed controller without erasing last use',async()=>{const{store,service}=await setup();const first=await request(service);await service.execute(admin,'control.approve',{grantId:first.grant});expect((await status(store,now+31_000)).currentUserId).toBeUndefined();expect((await status(store,now+31_000)).lastUserId).toBe('user');expect((await status(store,now+31_000)).availability).toBe('Available');});
});
