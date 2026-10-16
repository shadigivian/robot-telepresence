import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it} from 'vitest';
import {BrowserStore} from '../services/demo/store';
import {DemoService} from '../services/demo/service';
import type {Database,RobotCommand} from '../domain/models';

const user={userId:'user',organizationId:'org-hospital'},admin={userId:'admin',organizationId:'org-hospital'};
const stores:BrowserStore[]=[];let counter=0;
async function setup(){const store=new BrowserStore(`organization-control-${++counter}`,()=>1_000_000);stores.push(store);await store.read();return{store,service:new DemoService(store,()=>1_000_000)};}
afterEach(async()=>{for(const store of stores.splice(0))await store.close();});
async function grant(service:DemoService,actor=user){const session=(await service.execute(actor,'session.create',{robotId:'robot-7'}))!;await service.execute(actor,'session.join',{id:session});const request=(await service.execute(actor,'control.request',{sessionId:session}))!;await service.execute(admin,'control.approve',{id:request});return{session,request};}
function command(db:Database,id:string):RobotCommand{const g=db.grants.find(g=>g.id===id)!;return{version:1,organizationId:g.organizationId,robotId:g.robotId,sessionId:g.sessionId,leaseId:g.leaseId,generation:g.generation,sequence:g.lastSequence+1,linear:.3,angular:0,issuedAt:1_000_000,deadline:1_000_400,ttl:400};}

describe('organization telepresence control lifecycle',()=>{
 it('denying an active grant stops its motion immediately',async()=>{const{store,service}=await setup();const{request}=await grant(service);await service.execute(user,'control.command',{command:command(await store.read(),request)});await service.execute(admin,'control.deny',{id:request});const db=await store.read();expect(db.grants.find(g=>g.id===request)?.status).toBe('denied');expect(db.robots.find(r=>r.id==='robot-7')?.telemetry.linear).toBe(0);});
 it('stale revoke never cancels a newer lease',async()=>{const{store,service}=await setup();const old=await grant(service);await service.execute(user,'control.release',{id:old.request});const next=await grant(service,admin);await service.execute(admin,'control.command',{command:command(await store.read(),next.request)});await service.execute(admin,'control.revoke',{id:old.request});const db=await store.read();expect(db.grants.find(g=>g.id===next.request)?.status).toBe('granted');expect(db.robots.find(r=>r.id==='robot-7')?.telemetry.linear).toBe(.3);});
 it('ending an already ended session leaves a newer session lease untouched',async()=>{const{store,service}=await setup();const old=await grant(service);await service.execute(user,'session.end',{id:old.session});const next=await grant(service,admin);await service.execute(admin,'control.command',{command:command(await store.read(),next.request)});await service.execute(user,'session.end',{id:old.session});const db=await store.read();expect(db.grants.find(g=>g.id===next.request)?.status).toBe('granted');expect(db.robots.find(r=>r.id==='robot-7')?.telemetry.linear).toBe(.3);});
 it('releasing an older pending request does not stop another operator',async()=>{const{store,service}=await setup();const session=(await service.execute(user,'session.create',{robotId:'robot-7'}))!;await service.execute(user,'session.join',{id:session});const pending=(await service.execute(user,'control.request',{sessionId:session}))!;const next=await grant(service,admin);await service.execute(admin,'control.command',{command:command(await store.read(),next.request)});await service.execute(user,'control.release',{id:pending});const db=await store.read();expect(db.grants.find(g=>g.id===next.request)?.status).toBe('granted');expect(db.robots.find(r=>r.id==='robot-7')?.telemetry.linear).toBe(.3);});
});
