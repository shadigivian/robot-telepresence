import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Actor, Database, Invitation, Role } from '../domain/models';
import { roleFor, scoped } from '../domain/permissions';
import { BrowserStore } from '../services/demo/store';
import { DemoService } from '../services/demo/service';
import { localMedia } from '../services/demo/media';
import {demoAvailable,stagingDemo,stagingRoleAllowed,surface} from './runtime';

export const store = new BrowserStore();
export const service = new DemoService(store);
type Identity = Actor & {expiresAt:number};
export interface DemoContext {
 db: Database; publicDb: Database; actor:Actor|null; role:Role;
 organization:Database['organizations'][number]|undefined;
 act(action:string,payload?:Record<string,unknown>):Promise<string|undefined>;
 login(userId:string,organizationId?:string):boolean;
 switchPersona(userId:string,organizationId?:string):void;
 selectOrganization(organizationId?:string):void;
 logout():void; reset():Promise<void>; notify(message:string):void;
 lookupInvitation(token:string):Invitation|undefined;
 lookupOrganization(id:string):Database['organizations'][number]|undefined;
 findDemoIdentity(email:string):Database['users'][number]|undefined;
 acceptInvitationDemo(token:string,name:string):Promise<string|undefined>;
}
const Context=createContext<DemoContext|null>(null);
function readIdentity():Identity|null {if(!demoAvailable)return null;try {const text=sessionStorage.getItem('feedar.identity');if(!text)return null;const id=JSON.parse(text) as Identity;return typeof id.userId==='string'&&Number.isFinite(id.expiresAt)&&id.expiresAt>Date.now()?id:null;}catch{return null;}}
function publicRecords(raw:Database):Database {
 const db=structuredClone(raw);
 db.organizations=db.organizations.filter(o=>o.status==='active').map(o=>({...o,internalGuidance:undefined,rules:undefined,policyPdf:undefined}));
 const ids=new Set(db.organizations.map(o=>o.id));
 db.robots=db.robots.filter(r=>ids.has(r.organizationId)&&r.status==='active'&&r.pairing==='paired').map(r=>({...r,pairingCode:undefined}));
 db.maps=db.maps.filter(m=>ids.has(m.organizationId)&&m.active);
 db.points=db.points.filter(p=>ids.has(p.organizationId));
 db.locations=db.locations.filter(p=>ids.has(p.organizationId));
 db.floors=db.floors.filter(p=>ids.has(p.organizationId));
 db.knowledge=db.knowledge.filter(k=>ids.has(k.organizationId)&&k.status==='published');
 db.departments=[];db.users=db.users.filter(u=>u.status==='active'&&db.robots.some(r=>r.assignedUserIds.includes(u.id))).map(u=>({...u,email:'',avatar:undefined}));db.memberships=[];db.registeredRobots=[];db.creditEntries=[];db.invitations=[];db.sessions=[];db.grants=[];db.messages=[];db.missions=[];db.audits=[];db.tickets=[];db.incidents=[];db.releases=[];db.notifications=[];db.visitorRequests=[];db.assignments=[];db.calls=[];db.participants=[];db.conversations=[];
 return db;
}
export function DemoProvider({children}:{children:ReactNode}){
 const [raw,setRaw]=useState<Database>();const [identity,setIdentity]=useState<Identity|null>(readIdentity);
 const access=useRef({raw,identity});access.current={raw,identity};
 const [toast,setToast]=useState('');const toastTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const notify=useCallback((message:string)=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),6500);},[]);
 const releaseAccess=useCallback(()=>{localMedia.stop();window.dispatchEvent(new Event('feedar-navigation'));const current=access.current;if(!current.raw||!current.identity)return;for(const grant of current.raw.grants.filter(g=>g.operatorId===current.identity!.userId&&['granted','pending'].includes(g.status)))void service.execute(current.identity,'control.release',{grantId:grant.id}).catch(()=>{});for(const session of current.raw.sessions.filter(s=>s.userId===current.identity!.userId&&!['ended','expired','revoked','rejected'].includes(s.status)))void service.execute(current.identity,'session.end',{sessionId:session.id}).catch(()=>{});},[]);
 const logout=useCallback(()=>{releaseAccess();setIdentity(null);try{sessionStorage.removeItem('feedar.identity');}catch{/* tab-only memory remains available */}},[releaseAccess]);
 const login=useCallback((userId:string,organizationId?:string)=>{
  if(!demoAvailable||!raw)return false;
  const inferredOrg=organizationId??(raw.users.find(u=>u.id===userId)?.platformRole==='BOSS'?undefined:raw.memberships.find(m=>m.userId===userId&&m.status==='active')?.organizationId);
  const actor={userId,organizationId:inferredOrg};const nextRole=roleFor(raw,actor);if(nextRole==='GUEST'||(stagingDemo&&!stagingRoleAllowed(surface,nextRole))){notify('This demo identity is unavailable on this workspace.');return false;}
  releaseAccess();const next={...actor,expiresAt:Date.now()+8*60*60*1000};setIdentity(next);try{sessionStorage.setItem('feedar.identity',JSON.stringify(next));}catch{notify('Browser storage is unavailable. Identity lasts only in this tab until reload.');}
  return true;
 },[raw,notify,releaseAccess]);
 useEffect(()=>{let disposed=false;const refresh=()=>void store.read().then(db=>{if(!disposed)setRaw(db);}).catch(e=>notify(String(e)));refresh();const unsubscribe=store.subscribe(refresh);const timer=setInterval(()=>{void service.tick().catch(e=>notify(String(e)));},200);return()=>{disposed=true;unsubscribe();clearInterval(timer);localMedia.stop();clearTimeout(toastTimer.current);};},[notify]);
 useEffect(()=>{if(!identity||!raw)return;const check=()=>{const currentRole=roleFor(raw,identity);if(identity.expiresAt<=Date.now()||currentRole==='GUEST'||(stagingDemo&&!stagingRoleAllowed(surface,currentRole))){logout();notify('Demo access expired or was suspended. Sign in with an active demo identity.');}};check();const timer=setInterval(check,1000);return()=>clearInterval(timer);},[identity,raw,logout,notify]);
 const act=useCallback(async(action:string,payload:Record<string,unknown>={})=>{
  if(!demoAvailable&&action!=='kiosk.tool'){notify('Shared backend is required for this action.');return;}
  if(!identity&&action!=='kiosk.tool'){notify('Sign in with a demo account to perform this action.');return;}
  try{const result=await service.execute(action==='kiosk.tool'?{userId:'kiosk'}:identity!,action,payload);setRaw(await store.read());return result;}catch(e){notify(e instanceof Error?e.message:String(e));return undefined;}
 },[identity,notify]);
 const reset=useCallback(async()=>{localMedia.stop();await store.reset();setRaw(await store.read());notify('Demo data reset. Simulation stopped and fictional fixtures restored.');},[notify]);
 const acceptInvitationDemo=useCallback(async(token:string,name:string)=>{if(!demoAvailable||stagingDemo)return undefined;try{const result=await service.acceptDemoInvitation(token,name);const updated=await store.read();setRaw(updated);const next={userId:result.userId,organizationId:result.organizationId,expiresAt:Date.now()+8*60*60*1000};setIdentity(next);try{sessionStorage.setItem('feedar.identity',JSON.stringify(next));}catch{/* tab-only identity */}return result.id;}catch(e){notify(e instanceof Error?e.message:String(e));return undefined;}},[notify]);
 const value=useMemo<DemoContext|undefined>(()=>raw?{db:identity?scoped(raw,identity):publicRecords(raw),publicDb:publicRecords(raw),actor:identity,role:identity?roleFor(raw,identity):'GUEST',organization:raw.organizations.find(o=>o.id===identity?.organizationId),act,login,switchPersona:login,selectOrganization:organizationId=>{if(identity){login(identity.userId,organizationId);if(raw.users.find(u=>u.id===identity.userId)?.platformRole==='BOSS'&&organizationId)void service.execute(identity,'organization.support',{organizationId}).catch(e=>notify(String(e)));}},logout,reset,notify,lookupInvitation:token=>raw.invitations.find(i=>i.token===token),lookupOrganization:id=>raw.organizations.find(o=>o.id===id),findDemoIdentity:email=>email.toLowerCase().endsWith('.example')?raw.users.find(u=>u.email.toLowerCase()===email.toLowerCase()):undefined,acceptInvitationDemo}:undefined,[raw,identity,act,login,logout,reset,notify,acceptInvitationDemo]);
 if(!value)return <main className="loading"><span className="logo-tile">f</span><h1>Preparing Feedar Cloud</h1><p>Loading fictional browser demo records…</p></main>;
 return <Context.Provider value={value}>{children}{toast&&<div className="toast" role="status"><span>{toast}</span><button aria-label="Dismiss notification" onClick={()=>setToast('')}>×</button></div>}{'warning' in store&&typeof store.warning==='string'&&store.warning&&<div className="storage-warning" role="status">{store.warning}</div>}</Context.Provider>;
}
export function useDemo(){const context=useContext(Context);if(!context)throw new Error('Demo context is unavailable.');return context;}
