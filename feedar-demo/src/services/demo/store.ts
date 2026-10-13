import type { Database } from '../../domain/models';
import type { Store } from '../contracts';
import { seedDatabase } from '../../data/seed';

const arrayKeys = ['organizations','users','memberships','robots','invitations','sessions','grants','messages','maps','points','missions','knowledge','audits','tickets','incidents','releases','notifications','locations','floors','assignments','calls','participants','conversations'] as const;
export function isDatabase(value: unknown): value is Database {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if(v.simulatorTimestamp!==undefined&&!Number.isFinite(v.simulatorTimestamp))return false;
  if (v.schemaVersion !== 1 || !Number.isInteger(v.revision) || Number(v.revision) < 1 || arrayKeys.some(k => !Array.isArray(v[k]))) return false;
  if (arrayKeys.some(k => (v[k] as unknown[]).some(item => !item || typeof item !== 'object' || typeof (item as {id?:unknown}).id !== 'string'))) return false;
  const db = value as Database;
  const lifecycles=['active','suspended','archived'];
  if(arrayKeys.some(k=>new Set(db[k].map(row=>row.id)).size!==db[k].length||db[k].some(row=>!Number.isFinite(row.createdAt)||!Number.isFinite(row.updatedAt)||!Number.isInteger(row.revision)||row.revision<1)))return false;
  const orgs = new Set(db.organizations.map(o=>o.id)), users = new Set(db.users.map(u=>u.id)), robots = new Set(db.robots.map(r=>r.id)), sessions = new Set(db.sessions.map(s=>s.id));
  if(db.users.some(u=>typeof u.name!=='string'||typeof u.email!=='string'||!u.email.endsWith('.example')||!lifecycles.includes(u.status)||(u.platformRole!==undefined&&u.platformRole!=='BOSS')))return false;
  if (db.organizations.some(o=>!o.name || !o.slug || !o.quotas || !users.has(o.ownerId)||!lifecycles.includes(o.status)||!['en','fa','tr'].includes(o.language)||!Number.isFinite(o.speedLimit)||(['robots','users','branches','sessions'] as const).some(k=>!Number.isFinite(o.quotas[k])||o.quotas[k]<1))) return false;
  if (db.memberships.some(m=>!orgs.has(m.organizationId)||!users.has(m.userId)||!['OWNER','ADMIN','USER'].includes(m.role))) return false;
  if(db.memberships.some(m=>!lifecycles.includes(m.status)||!Array.isArray(m.capabilities)||m.capabilities.some(c=>typeof c!=='string')))return false;
  if(db.locations.some(l=>!orgs.has(l.organizationId)||typeof l.name!=='string')||db.floors.some(f=>!orgs.has(f.organizationId)||!db.locations.some(l=>l.id===f.locationId&&l.organizationId===f.organizationId)))return false;
  if (db.robots.some(r=>!orgs.has(r.organizationId)||!r.telemetry||!Array.isArray(r.assignedUserIds)||r.assignedUserIds.some(id=>!users.has(id))||!Array.isArray(r.capabilities)||!Number.isFinite(r.x)||!Number.isFinite(r.y)||r.x<0||r.x>100||r.y<0||r.y>100||!Number.isFinite(r.heading)||!Number.isFinite(r.battery)||!lifecycles.includes(r.status)||!db.floors.some(f=>f.id===r.floorId&&f.organizationId===r.organizationId))) return false;
  if(db.robots.some(r=>['timestamp','linear','angular','leftWheel','rightWheel','wheelRadius','trackWidth','latency','signal','temperature'].some(key=>!Number.isFinite(r.telemetry[key as keyof typeof r.telemetry]))||r.telemetry.trackWidth<=0||r.telemetry.wheelRadius<=0))return false;
  if (db.sessions.some(s=>!orgs.has(s.organizationId)||!db.robots.some(r=>r.id===s.robotId&&r.organizationId===s.organizationId)||!users.has(s.userId)||!Array.isArray(s.participantIds)||s.participantIds.some(id=>!users.has(id))||!Array.isArray(s.capabilities)||!Number.isFinite(s.expiresAt))) return false;
  if (db.grants.some(g=>!sessions.has(g.sessionId)||!robots.has(g.robotId)||!users.has(g.operatorId))) return false;
  if (db.messages.some(m=>!sessions.has(m.sessionId)||!orgs.has(m.organizationId))) return false;
  if(db.invitations.some(i=>!orgs.has(i.organizationId)||typeof i.token!=='string'||typeof i.invitee!=='string'||!i.invitee.endsWith('.example')||!Array.isArray(i.robotIds)||i.robotIds.some(id=>!db.robots.some(r=>r.id===id&&r.organizationId===i.organizationId))||!Array.isArray(i.capabilities)||!Number.isFinite(i.expiresAt)))return false;
  if(db.maps.some(m=>!orgs.has(m.organizationId)||!db.floors.some(f=>f.id===m.floorId&&f.organizationId===m.organizationId)||typeof m.active!=='boolean')||db.points.some(p=>!db.floors.some(f=>f.id===p.floorId&&f.organizationId===p.organizationId)||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
  if(db.knowledge.some(k=>!orgs.has(k.organizationId)||typeof k.text!=='string'||typeof k.title!=='string'||!['draft','published','archived'].includes(k.status)))return false;
  return true;
}
interface MemoryState { database: Database; queue: Promise<unknown>; listeners: Set<() => void> }
const memoryDatabases = new Map<string, MemoryState>();
export class BrowserStore implements Store {
  warning: string | null = null;
  private connection?: Promise<IDBDatabase | null>;
  private channel?: BroadcastChannel;
  private listeners = new Set<() => void>();
  private memory: MemoryState;
  constructor(private readonly name = 'feedar-demo-v1', private readonly clock = Date.now) {
    const prior = memoryDatabases.get(name);
    this.memory = prior ?? { database:seedDatabase(clock()),queue:Promise.resolve(),listeners:new Set() };
    memoryDatabases.set(name,this.memory);
    this.memory.listeners.add(this.notify);
    if (typeof BroadcastChannel !== 'undefined') { this.channel=new BroadcastChannel(name); this.channel.onmessage=()=>this.notify(); }
  }
  private notify = () => { for (const listener of this.listeners) listener(); };
  private open(): Promise<IDBDatabase | null> {
    if (this.connection) return this.connection;
    this.connection = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') { this.warning='IndexedDB unavailable: this demo is in memory only. Reloading loses changes, and cross-tab control demonstration is unavailable.'; resolve(null); return; }
      try {
        const request=indexedDB.open(this.name,1);
        request.onupgradeneeded=()=>{ if (!request.result.objectStoreNames.contains('snapshots')) request.result.createObjectStore('snapshots'); };
        request.onsuccess=()=>{ request.result.onversionchange=()=>request.result.close(); resolve(request.result); };
        request.onerror=()=>{ this.warning='Browser persistence is unavailable. Changes are in memory only; cross-tab control is disabled.'; resolve(null); };
        request.onblocked=()=>{ this.warning='Demo storage is blocked by another tab. Close older demo tabs and reload.'; };
      } catch { this.warning='Browser persistence is unavailable. Changes are in memory only; cross-tab control is disabled.'; resolve(null); }
    });
    return this.connection;
  }
  async read(): Promise<Database> {
    const database=await this.open();
    if (!database) { await this.memory.queue; return structuredClone(this.memory.database); }
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction('snapshots','readwrite');
      const store=transaction.objectStore('snapshots'), request=store.get('current');
      let snapshot:Database;
      request.onsuccess=()=>{
        if (request.result === undefined) { snapshot=seedDatabase(this.clock()); store.put(snapshot,'current'); }
        else if (!isDatabase(request.result)) { this.warning='Corrupted or unsupported demo records were replaced with fictional seed data. No credentials or private data were recovered.'; snapshot=seedDatabase(this.clock()); store.put(snapshot,'current'); }
        else snapshot=request.result as Database;
      };
      transaction.oncomplete=()=>resolve(structuredClone(snapshot));
      transaction.onerror=()=>reject(new Error('Unable to read demo storage. Check browser storage permissions.'));
      transaction.onabort=()=>reject(new Error('Unable to read demo storage. Check browser storage permissions.'));
    });
  }
  async transaction<T>(update:(database:Database)=>T):Promise<T> {
    const database=await this.open();
    if (!database) {
      let result!:T;
      const operation=this.memory.queue.then(()=>{
        const draft=structuredClone(this.memory.database); result=update(draft);
        if (result && typeof (result as {then?:unknown}).then === 'function') throw new Error('Store transactions must be synchronous.');
        draft.revision++; this.memory.database=draft;
        for (const notify of this.memory.listeners) notify();
      });
      this.memory.queue=operation.catch(()=>{}); await operation; return result;
    }
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction('snapshots','readwrite');
      const store=transaction.objectStore('snapshots'), request=store.get('current');
      let result:T, failure:unknown;
      request.onsuccess=()=>{
        try {
          const draft=isDatabase(request.result)?request.result:seedDatabase(this.clock());
          if (request.result!==undefined&&!isDatabase(request.result)) this.warning='Corrupted demo records were reset to fictional seed data.';
          result=update(draft);
          if (result && typeof (result as {then?:unknown}).then === 'function') throw new Error('Store transactions must be synchronous.');
          draft.revision++; store.put(draft,'current');
        } catch(error) { failure=error; transaction.abort(); }
      };
      transaction.oncomplete=()=>{this.notify();this.channel?.postMessage({revision:true});resolve(result);};
      transaction.onabort=()=>reject(failure??new Error('Unable to save demo records. Storage may be full; your last saved data was preserved.'));
      transaction.onerror=()=>{this.warning='Demo save failed. Browser storage may be full; your last saved data was preserved.';};
    });
  }
  subscribe(callback:()=>void):()=>void {this.listeners.add(callback);return()=>this.listeners.delete(callback);}
  async reset():Promise<void> { await this.transaction(db=>Object.assign(db,seedDatabase(this.clock()))); }
  async close():Promise<void> { this.channel?.close();this.memory.listeners.delete(this.notify);(await this.connection)?.close();this.listeners.clear(); }
}
