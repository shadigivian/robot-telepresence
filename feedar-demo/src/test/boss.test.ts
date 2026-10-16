import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { BrowserStore, isDatabase } from '../services/demo/store';
import { DemoService } from '../services/demo/service';
import { normalizePhone } from '../domain/phone';
import { seedDatabase } from '../data/seed';

const boss={userId:'boss'},owner={userId:'owner',organizationId:'org-hospital'},admin={userId:'admin',organizationId:'org-hospital'};
const stores:BrowserStore[]=[];let counter=0;
async function setup(){const store=new BrowserStore(`boss-test-${++counter}`,()=>1_000_000);stores.push(store);await store.read();return {store,service:new DemoService(store,()=>1_000_000)};}
afterEach(async()=>{for(const store of stores.splice(0))await store.close();});

describe('Boss organization and registry workflows',()=>{
  it('normalizes supported phone numbers and rejects malformed country-specific values',()=>{
    expect(normalizePhone('IR','09123456789')).toBe('+989123456789');expect(normalizePhone('US','(415) 555-2671')).toBe('+14155552671');
    expect(()=>normalizePhone('IR','12345')).toThrow();expect(()=>normalizePhone('IR','+14155552671')).toThrow();
  });
  it('requires and persists organization phone and generates one usable Owner invitation',async()=>{
    const {store,service}=await setup();const payload={name:'New Hospital',slug:'new-hospital',industry:'Healthcare',city:'Tehran',country:'Iran',timezone:'Asia/Tehran',contact:'help@new-hospital.example',phoneCountry:'IR',contactPhone:'09123456789',ownerName:'Ali Ahmadi',ownerEmail:'ali@new-hospital.example'};
    await expect(service.execute(boss,'organization.create',{...payload,contactPhone:''})).rejects.toThrow();
    const id=await service.execute(boss,'organization.create',payload);const db=await store.read();expect(db.organizations.find(o=>o.id===id)?.contactPhone).toBe('+989123456789');
    const invitation=db.invitations.find(i=>i.organizationId===id&&i.role==='OWNER')!;expect(invitation.status).toBe('pending');await service.acceptDemoInvitation(invitation.token,'Ali Ahmadi');
    expect((await store.read()).memberships.some(m=>m.organizationId===id&&m.role==='OWNER'&&m.status==='active')).toBe(true);
  });
  it('preserves v1 IndexedDB records while adding registry and credit arrays',async()=>{
    const name=`boss-legacy-${++counter}`;const legacy=seedDatabase(500) as unknown as Record<string,unknown>;delete legacy.registeredRobots;delete legacy.creditEntries;
    await new Promise<void>((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');request.onsuccess=()=>{const connection=request.result;const transaction=connection.transaction('snapshots','readwrite');transaction.objectStore('snapshots').put(legacy,'current');transaction.oncomplete=()=>{connection.close();resolve();};transaction.onerror=()=>reject(transaction.error);};request.onerror=()=>reject(request.error);});
    const store=new BrowserStore(name,()=>1_000_000);stores.push(store);const db=await store.read();expect(db.organizations[0]?.name).toBe('Future Health Hospital');expect(db.registeredRobots).toHaveLength(db.robots.length);expect(db.creditEntries).toEqual([]);expect(isDatabase(db)).toBe(true);
  });
  it('keeps credit ledger tenant scoped, idempotent, bounded and Boss-only',async()=>{
    const {store,service}=await setup();const payload={organizationId:'org-hospital',amount:50,operationId:'topup-once'};
    const id=await service.execute(boss,'credit.topup',payload);expect(await service.execute(boss,'credit.topup',payload)).toBe(id);
    await expect(service.execute(boss,'credit.topup',{...payload,amount:60})).rejects.toThrow(/Conflicting/);
    await expect(service.execute(owner,'credit.topup',{...payload,operationId:'owner'})).rejects.toThrow();
    await expect(service.execute(boss,'credit.topup',{...payload,amount:-1,operationId:'negative'})).rejects.toThrow();
    await expect(service.execute(boss,'credit.recordUsage',{organizationId:'org-hospital',amount:100,tokens:200,operationId:'too-much'})).rejects.toThrow();
    await service.execute(boss,'credit.recordUsage',{organizationId:'org-hospital',amount:10,tokens:200,operationId:'usage-one'});
    const db=await store.read();expect(db.creditEntries.filter(e=>e.organizationId==='org-hospital')).toHaveLength(2);expect(db.creditEntries.reduce((sum,e)=>sum+(e.kind==='topup'?e.amount:-e.amount),0)).toBe(40);
    expect(db.creditEntries.every(e=>e.actorId==='boss')).toBe(true);
  });
  it('registers unassigned, rejects duplicate identifiers, pairs once and transfers only by Boss release',async()=>{
    const {store,service}=await setup();const id=await service.execute(boss,'registry.register',{identifier:'FD-DEMO-0020',name:'Care Bot',model:'Feedar One'});
    let db=await store.read();expect(db.registeredRobots.find(r=>r.id===id)?.organizationId).toBeUndefined();expect(db.robots.some(r=>r.deviceId==='FD-DEMO-0020')).toBe(false);
    await expect(service.execute(boss,'registry.register',{identifier:'fd-demo-0020',name:'Duplicate',model:'Feedar One'})).rejects.toThrow(/already/);
    await expect(service.execute(owner,'registry.pair',{organizationId:'org-hospital',floorId:'floor-org-hospital-0',identifier:'NO-SUCH-DEVICE'})).rejects.toThrow();
    const robotId=await service.execute(owner,'registry.pair',{organizationId:'org-hospital',floorId:'floor-org-hospital-0',identifier:'FD-DEMO-0020'});
    await expect(service.execute(admin,'registry.pair',{organizationId:'org-hospital',floorId:'floor-org-hospital-0',identifier:'FD-DEMO-0020'})).rejects.toThrow(/already/);
    await expect(service.execute(owner,'registry.release',{id})).rejects.toThrow();
    await service.execute(boss,'registry.release',{id});db=await store.read();expect(db.robots.find(r=>r.id===robotId)?.status).toBe('archived');expect(db.registeredRobots.find(r=>r.id===id)?.organizationId).toBeUndefined();
    const next=await service.execute(boss,'registry.pair',{organizationId:'org-airport',floorId:'floor-org-airport-0',identifier:'FD-DEMO-0020'});db=await store.read();expect(db.robots.find(r=>r.id===next)?.organizationId).toBe('org-airport');expect(db.registeredRobots.find(r=>r.id===id)?.assignmentHistory).toHaveLength(2);expect(isDatabase(db)).toBe(true);
  });
  it('limits Boss support context and deactivation prevents organization pairing',async()=>{
    const {store,service}=await setup();const id=await service.execute(boss,'registry.register',{identifier:'FD-DEMO-0030',name:'Care Bot',model:'Feedar One'});
    await service.execute(boss,'registry.update',{id,status:'inactive'});
    await expect(service.execute(owner,'registry.pair',{organizationId:'org-hospital',floorId:'floor-org-hospital-0',identifier:'FD-DEMO-0030'})).rejects.toThrow();
    await expect(service.execute({...boss,organizationId:'org-hospital'},'organization.update',{id:'org-airport',name:'Wrong'})).rejects.toThrow();
    await service.execute({...boss,organizationId:'org-hospital'},'organization.update',{id:'org-hospital',name:'Boss edited'});
    const db=await store.read();expect(db.organizations.find(o=>o.id==='org-hospital')?.name).toBe('Boss edited');expect(db.organizations.find(o=>o.id==='org-airport')?.name).toBe('Atlas Airport Services');expect(db.audits.at(-1)?.actorId).toBe('boss');
  });
});
