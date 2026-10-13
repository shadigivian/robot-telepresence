import type { Actor, Database, Invitation, Membership, Organization, RecordBase, Robot, Session } from '../../domain/models';
import type { Provider, Store } from '../contracts';
import { ACTIONS, can, roleFor } from '../../domain/permissions';
import { applyCommand, revokeRobot, tickSimulation, zeroRobot } from '../../simulator/controller';

const uid = (prefix:string) => `${prefix}-${globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)+Date.now().toString(36)}`;
const text = (value:unknown,name:string,max=200,optional=false):string => {if(typeof value!=='string'||(!optional&&!value.trim())||value.length>max)throw new Error(`Enter a valid ${name} (${max} characters maximum).`);return value.trim();};
const email = (value:unknown):string => {const e=text(value,'fictional email').toLowerCase();if(!/^[^\s@]+@[^\s@]+\.example$/.test(e))throw new Error('Use a fictional email address ending in .example.');return e;};
const number = (value:unknown,name:string,min=0,max=100):number => {if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(`Invalid ${name}: use a value from ${min} to ${max}.`);return value;};
const base = (prefix:string,now:number):RecordBase => ({id:uid(prefix),createdAt:now,updatedAt:now,revision:1});
const touch = (entity:RecordBase,now:number) => {entity.updatedAt=now;entity.revision++;};
const activeSessions = (db:Database) => db.sessions.filter(s=>!['ended','expired','revoked','rejected'].includes(s.status));
function strings(value:unknown):string[]{if(!Array.isArray(value)||value.some(v=>typeof v!=='string'))throw new Error('Expected a list of identifiers.');return [...new Set(value as string[])];}
function find<T extends {id:string}>(records:T[],id:unknown,label:string):T {const record=records.find(r=>r.id===id);if(!record)throw new Error(`${label} not found.`);return record;}
function invalidate(db:Database,organizationId:string,now:number,userId?:string,robotId?:string):void {
  const ids=new Set(activeSessions(db).filter(s=>s.organizationId===organizationId&&(!userId||s.userId===userId||s.participantIds.includes(userId))&&(!robotId||s.robotId===robotId)).map(s=>s.id));
  for(const session of db.sessions)if(ids.has(session.id)){session.status='revoked';touch(session,now);}
  for(const robot of db.robots)if(robot.organizationId===organizationId&&(!robotId||robot.id===robotId)&&(!userId||db.grants.some(g=>g.robotId===robot.id&&g.operatorId===userId&&['pending','granted'].includes(g.status))))revokeRobot(db,robot,now);
  for(const invitation of db.invitations)if(invitation.organizationId===organizationId&&invitation.status==='pending'&&(!robotId||invitation.robotIds.includes(robotId))&&(!userId||invitation.invitee===db.users.find(u=>u.id===userId)?.email)){invitation.status='revoked';invitation.revokedAt=now;}
}
function robotAllowed(db:Database,actor:Actor,robot:Robot):void {
  if(roleFor(db,actor,robot.organizationId)==='USER'&&!robot.assignedUserIds.includes(actor.userId))throw new Error('This robot is not assigned to your membership.');
}
function sessionAllowed(db:Database,actor:Actor,session:Session):void {
  const robot=find(db.robots,session.robotId,'Robot');robotAllowed(db,actor,robot);
  if(roleFor(db,actor,session.organizationId)==='USER'&&session.userId!==actor.userId&&!session.participantIds.includes(actor.userId))throw new Error('This session is not authorized for your identity.');
}
function ownerProtection(db:Database,member:Membership,status:unknown,role:unknown):void {
  if(member.role==='OWNER'&&member.status==='active'&&(status!=='active'||role!=='OWNER')&&!db.memberships.some(m=>m.id!==member.id&&m.organizationId===member.organizationId&&m.role==='OWNER'&&m.status==='active'))throw new Error('Transfer ownership before removing, suspending, or demoting the last active Owner.');
}
function createInvitation(db:Database,actor:Actor,p:Record<string,unknown>,organizationId:string,now:number):Invitation {
  const role=p.role??'USER';if(!['OWNER','ADMIN','USER'].includes(String(role)))throw new Error('Unknown invitation role.');
  const actorRole=roleFor(db,actor,organizationId);if(actorRole==='ADMIN'&&role!=='USER')throw new Error('Admins can invite ordinary Users only.');
  if(role==='OWNER'&&actorRole!=='BOSS'&&actorRole!=='OWNER')throw new Error('Owner assignment is not authorized.');
  const robotIds=p.robotIds===undefined?[]:strings(p.robotIds);
  for(const robotId of robotIds)if(find(db.robots,robotId,'Robot').organizationId!==organizationId)throw new Error('An invitation cannot assign another tenant’s robot.');
  const capabilities=p.capabilities===undefined?['video','chat','screen','control']:strings(p.capabilities);
  if(capabilities.some(c=>!['video','chat','screen','control','maps','missions'].includes(c)))throw new Error('Unknown invitation capability.');
  if((role==='USER'||p.kind==='session')&&capabilities.some(c=>['maps','missions'].includes(c)))throw new Error('User/session invitations cannot grant administrative map or mission capabilities.');
  const expiresAt=p.expiresAt===undefined?now+7*86400000:number(p.expiresAt,'invitation expiry',now+1,now+30*86400000);
  const invite:Invitation={...base('invite',now),organizationId,kind:p.kind==='session'?'session':'membership',token:uid('demo'),role:role as Invitation['role'],invitee:email(p.invitee),inviterId:actor.userId,robotIds,capabilities,expiresAt,status:'pending'};
  if(invite.kind==='session'&&robotIds.length!==1)throw new Error('A session invitation requires exactly one robot.');
  db.invitations.push(invite);return invite;
}
function makeSession(db:Database,actor:Actor,robot:Robot,p:Record<string,unknown>,now:number):Session {
  robotAllowed(db,actor,robot);
  if(robot.status!=='active'||robot.connectivity!=='online'||robot.pairing!=='paired'||robot.mode==='maintenance'||robot.fault)throw new Error('Robot is unavailable for a demo session.');
  const org=find(db.organizations,robot.organizationId,'Organization');
  if(activeSessions(db).filter(s=>s.organizationId===org.id).length>=org.quotas.sessions)throw new Error('Organization session quota reached.');
  const membership=db.memberships.find(m=>m.organizationId===org.id&&m.userId===actor.userId&&m.status==='active');
  const assignment=db.assignments.find(a=>a.robotId===robot.id&&a.userId===actor.userId&&a.organizationId===robot.organizationId);
  const permitted=membership?.role==='USER'?['video','chat','screen','control'].filter(c=>membership.capabilities.includes(c)&&(!assignment||assignment.capabilities.includes(c))):['video','chat','screen','control'];
  const capabilities=p.capabilities===undefined?permitted:strings(p.capabilities);
  if(capabilities.some(c=>!['video','chat','screen','control'].includes(c)))throw new Error('Unknown session capability.');
  if(capabilities.some(c=>!permitted.includes(c)))throw new Error('Session capabilities exceed your membership or robot assignment.');
  const session:Session={...base('session',now),organizationId:org.id,robotId:robot.id,userId:actor.userId,status:'waiting',capabilities,participantIds:[actor.userId],expiresAt:p.expiresAt===undefined?now+30*60000:number(p.expiresAt,'session expiry',now+1,now+60*60000)};
  db.sessions.push(session);robot.currentSessionId=session.id;return session;
}

export const AVAILABLE_ACTIONS = ACTIONS;
export class DemoService implements Provider {
  constructor(readonly store:Store,private readonly clock=Date.now){}
  async acceptDemoInvitation(token:string,name:string):Promise<{id:string;userId:string;organizationId:string}>{
    return this.store.transaction(db=>{
      const now=this.clock(),invite=db.invitations.find(i=>i.token===token);
      if(!invite)throw new Error('Unknown invitation. Dynamic invitations are available only in their originating browser.');
      if(invite.status!=='pending'||invite.expiresAt<=now)throw new Error(invite.expiresAt<=now?'Invitation expired.':`Invitation is ${invite.status}.`);
      const org=find(db.organizations,invite.organizationId,'Organization');if(org.status!=='active')throw new Error('Organization is unavailable.');
      let user=db.users.find(u=>u.email===invite.invitee);
      if(!user){user={...base('user',now),name:text(name,'fictional recipient name'),email:email(invite.invitee),status:'active'};db.users.push(user);}
      if(user.status!=='active')throw new Error('This demo identity is suspended.');
      const id=applyAction(db,{userId:user.id},'invitation.accept',{token},now)!;
      return{id,userId:user.id,organizationId:org.id};
    });
  }
  async execute(actor:Actor,originalAction:string,payload:Record<string,unknown>={}):Promise<string|undefined>{
    let action=originalAction,p={...payload};
    if(action==='robot.estopAll'){action='control.estop';p.all=true;}
    if(action==='robot.resetStop')action='control.reset';
    if(action==='robot.scenario'){action='scenario.apply';p.robotId=p.robotId??p.id;}
    if(action==='robot.maintenance'){action='robot.update';p.mode='maintenance';}
    if(action==='robot.reboot'){action='robot.update';p.reboot=true;}
    if(p.updates&&typeof p.updates==='object')p={...p,...p.updates as Record<string,unknown>};
    const blob=p.blob;
    if(blob!==undefined){
      if(!(blob instanceof Blob))throw new Error('Uploaded file is invalid.');
      if(action.startsWith('map.')){
        if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>5*1024*1024)throw new Error('Maps accept PNG, JPEG, or WebP up to 5 MB.');
        const bytes=new Uint8Array(await blob.slice(0,16).arrayBuffer());
        const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
        if(!((blob.type==='image/png'&&png)||(blob.type==='image/jpeg'&&jpeg)||(blob.type==='image/webp'&&webp)))throw new Error('File contents do not match a supported map image.');
      }else if(action.startsWith('knowledge.')&&(!['application/pdf','text/plain'].includes(blob.type)||blob.size>10*1024*1024))throw new Error('Knowledge attachments accept PDF/text up to 10 MB; indexing is not configured.');
    }
    try{return await this.store.transaction(db=>applyAction(db,actor,action,p,this.clock()));}
    catch(error){
      await this.store.transaction(db=>{db.audits.push({...base('audit',this.clock()),actorId:actor.userId,organizationId:actor.organizationId,role:roleFor(db,actor),action:originalAction,severity:'warning',outcome:'denied',summary:'Demo operation denied or rejected by validation.'});}).catch(()=>{});
      throw error;
    }
  }
  async tick():Promise<void>{const now=this.clock();await this.store.transaction(db=>{const previous=db.simulatorTimestamp??now;tickSimulation(db,now,Math.max(0,now-previous));db.simulatorTimestamp=Math.max(now,previous);});}
}

export function applyAction(db:Database,actor:Actor,action:string,p:Record<string,unknown>,now:number):string|undefined{
  const id=p.id??p.robotId??p.sessionId??p.grantId??p.invitationId??p.mapId??p.pointId??p.missionId??p.knowledgeId;
  let organizationId=typeof p.organizationId==='string'?p.organizationId:actor.organizationId;
  let entity:{id:string;organizationId?:string}|undefined;
  const family=action.split('.')[0];
  const collections:{[key:string]:{id:string;organizationId?:string}[]}={organization:db.organizations,member:db.memberships,invitation:db.invitations,robot:db.robots,session:db.sessions,control:db.grants,chat:db.messages,map:db.maps,point:db.points,mission:db.missions,knowledge:db.knowledge,ticket:db.tickets,notification:db.notifications,update:db.releases,incident:db.incidents,location:db.locations,floor:db.floors};
  if(id&&collections[family])entity=collections[family].find(e=>e.id===id);
  if(entity)organizationId=family==='organization'?entity.id:entity.organizationId;
  if(action.startsWith('control.')&&p.robotId)organizationId=db.robots.find(r=>r.id===p.robotId)?.organizationId??organizationId;
  if(['control.halt','control.stop','control.estop','control.reset'].includes(action)&&id&&!p.all)organizationId=db.robots.find(r=>r.id===id)?.organizationId??organizationId;
  if(action==='control.command'&&p.command&&typeof p.command==='object')organizationId=(p.command as {organizationId?:string}).organizationId;
  if(['control.request','chat.send','chat.read'].includes(action)&&p.sessionId)organizationId=db.sessions.find(s=>s.id===p.sessionId)?.organizationId??organizationId;
  if(['session.create','update.start'].includes(action)&&p.robotId)organizationId=db.robots.find(r=>r.id===p.robotId)?.organizationId??organizationId;
  if(action==='scenario.apply'&&p.robotId)organizationId=db.robots.find(r=>r.id===p.robotId)?.organizationId??organizationId;
  if(action==='kiosk.tool')return kioskTool(db,p,now);
  if(!can(db,actor,action,organizationId))throw new Error('This action is not permitted for your demo role or tenant.');
  if(organizationId&&action!=='invitation.accept')find(db.organizations,organizationId,'Organization');
  const org=()=>find(db.organizations,organizationId,'Organization');
  const role=roleFor(db,actor,organizationId);
  let result:string|undefined;
  switch(action){
    case 'organization.create':{
      const slug=text(p.slug,'slug',60);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||db.organizations.some(o=>o.slug===slug))throw new Error('Use a unique lowercase slug with letters, numbers, and hyphens.');
      const ownerEmail=email(p.ownerEmail??p.email);let owner=db.users.find(u=>u.email===ownerEmail);
      if(!owner){owner={...base('user',now),name:text(p.ownerName??'Organization Owner','owner name'),email:ownerEmail,status:'active'};db.users.push(owner);}
      const organization:Organization={...base('org',now),name:text(p.name,'organization name'),slug,industry:text(p.industry??'Healthcare','industry'),city:text(p.city??'Demo city','city'),country:text(p.country??'Demo country','country'),description:text(p.description??'A fictional Feedar organization.','description',1000,true),status:'active',ownerId:owner.id,color:'#6ce5d8',welcome:'Hello! How can I help you today?',language:p.language==='fa'||p.language==='tr'?p.language:'en',timezone:text(p.timezone??'UTC','timezone'),contact:typeof p.contact==='string'?p.contact:'help@feedar.example',quotas:{robots:12,users:100,branches:5,sessions:8},approvalRequired:true,speedLimit:0.5};
      if(p.quotas!==undefined){const q=p.quotas as Record<string,unknown>;organization.quotas={robots:number(q.robots,'robot quota',1,1000),users:number(q.users,'user quota',1,10000),branches:number(q.branches,'branch quota',1,1000),sessions:number(q.sessions,'session quota',1,1000)};}
      if(typeof p.logo==='string')organization.logo=p.logo;
      db.organizations.push(organization);createInvitation(db,actor,{role:'OWNER',invitee:owner.email},organization.id,now);result=organization.id;break;
    }
    case 'organization.update':{
      const o=org();for(const key of ['name','industry','city','country','description','timezone','contact','contactPhone','welcome','openingHours'] as const)if(p[key]!==undefined)o[key]=text(p[key],key,key==='description'||key==='welcome'?2000:300,true);
      if(p.preferredLanguages!==undefined){const languages=strings(p.preferredLanguages);if(!languages.length||languages.some(l=>!['en','fa','tr'].includes(l)))throw new Error('Choose English, Persian, or Turkish welcome languages.');o.preferredLanguages=languages as Organization['preferredLanguages'];}
      if(p.notificationPreferences!==undefined){const n=p.notificationPreferences as Record<string,unknown>;if(!n||['incidents','invitations','sessions'].some(k=>typeof n[k]!=='boolean'))throw new Error('Invalid notification preferences.');o.notificationPreferences={incidents:n.incidents as boolean,invitations:n.invitations as boolean,sessions:n.sessions as boolean};}
      if(p.slug!==undefined){const slug=text(p.slug,'slug',60);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||db.organizations.some(other=>other.id!==o.id&&other.slug===slug))throw new Error('Organization slug must be valid and unique.');o.slug=slug;}
      if(p.color!==undefined){const color=text(p.color,'brand color',7);if(!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Enter a six-digit hexadecimal brand color.');o.color=color;}
      if(p.language!==undefined){if(!['en','fa','tr'].includes(String(p.language)))throw new Error('Unsupported welcome language.');o.language=p.language as Organization['language'];}
      if(p.logo!==undefined){const logo=text(p.logo,'logo',7*1024*1024,true);if(logo&&!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(logo))throw new Error('Use a local PNG/JPEG/WebP logo.');o.logo=logo;}
      if(p.approvalRequired!==undefined){if(typeof p.approvalRequired!=='boolean')throw new Error('Invalid session approval preference.');o.approvalRequired=p.approvalRequired;}
      if(p.speedLimit!==undefined)o.speedLimit=number(p.speedLimit,'demo speed limit',0.05,0.5);
      if(p.quotas!==undefined){if(role!=='BOSS')throw new Error('Only Boss can change platform quotas.');const q=p.quotas as Record<string,unknown>;o.quotas={robots:number(q.robots,'robot quota',1,1000),users:number(q.users,'user quota',1,10000),branches:number(q.branches,'branch quota',1,1000),sessions:number(q.sessions,'session quota',1,1000)};}
      touch(o,now);result=o.id;break;
    }
    case 'organization.suspend':case 'organization.archive':case 'organization.reactivate':{
      const o=org();o.status=action.endsWith('reactivate')?'active':action.endsWith('archive')?'archived':'suspended';if(o.status!=='active')invalidate(db,o.id,now);touch(o,now);result=o.id;break;
    }
    case 'organization.delete':{
      const o=org();invalidate(db,o.id,now);db.organizations=db.organizations.filter(v=>v.id!==o.id);
      for(const key of ['memberships','robots','invitations','sessions','grants','messages','maps','points','missions','knowledge','locations','floors','assignments','calls','participants','conversations','incidents'] as const)(db[key] as {organizationId:string}[])=db[key].filter(v=>v.organizationId!==o.id);
      db.tickets=db.tickets.filter(v=>v.organizationId!==o.id);db.releases=db.releases.filter(v=>v.organizationId!==o.id);db.notifications=db.notifications.filter(v=>v.organizationId!==o.id);result=o.id;break;
    }
    case 'organization.transferOwner':{
      const o=org(),user=find(db.users,p.userId,'New Owner');if(user.status!=='active')throw new Error('Choose an active new Owner.');
      let member=db.memberships.find(m=>m.organizationId===o.id&&m.userId===user.id);if(!member){member={...base('member',now),organizationId:o.id,userId:user.id,role:'OWNER',status:'active',capabilities:['maps','missions','video','chat','screen','control']};db.memberships.push(member);}else{member.role='OWNER';member.status='active';}
      for(const prior of db.memberships)if(prior.organizationId===o.id&&prior.role==='OWNER'&&prior.id!==member.id){prior.role='ADMIN';invalidate(db,o.id,now,prior.userId);}
      o.ownerId=user.id;touch(o,now);result=o.id;break;
    }
    case 'organization.support':result=org().id;break;
    case 'member.invite':case 'invitation.create':result=createInvitation(db,actor,p,org().id,now).id;break;
    case 'member.update':case 'member.suspend':case 'member.reactivate':case 'member.remove':{
      const member=find(db.memberships,id,'Membership');
      if(role==='ADMIN'&&(member.role!=='USER'||member.userId===actor.userId||p.role!==undefined&&p.role!=='USER'))throw new Error('Admins cannot modify Admins, Owners, their own privileges, or promote Users.');
      const nextRole=p.role===undefined?member.role:p.role;
      if(!['OWNER','ADMIN','USER'].includes(String(nextRole)))throw new Error('Unknown membership role.');
      if(nextRole==='OWNER'&&member.role!=='OWNER')throw new Error('Use the explicit Owner transfer action.');
      const nextStatus=action==='member.suspend'?'suspended':action==='member.remove'?'archived':action==='member.reactivate'?'active':p.status??member.status;
      if(!['active','suspended','archived'].includes(String(nextStatus)))throw new Error('Unknown membership lifecycle state.');
      ownerProtection(db,member,nextStatus,nextRole);
      if(p.capabilities!==undefined){const caps=strings(p.capabilities);if(caps.some(c=>!['maps','missions','video','chat','screen','control'].includes(c)))throw new Error('Unknown membership capability.');if(role==='ADMIN'&&caps.some(c=>['maps','missions'].includes(c)))throw new Error('Admins cannot grant administrative capabilities.');member.capabilities=caps;}
      const changedAccess=member.role!==nextRole||member.status!==nextStatus||p.capabilities!==undefined;
      member.role=nextRole as Membership['role'];member.status=nextStatus as Membership['status'];
      const user=find(db.users,member.userId,'User');if(p.name!==undefined)user.name=text(p.name,'member name');if(p.email!==undefined){const e=email(p.email);if(db.users.some(u=>u.id!==user.id&&u.email===e))throw new Error('Email belongs to another demo identity.');user.email=e;invalidate(db,member.organizationId,now,user.id);}
      if(changedAccess)invalidate(db,member.organizationId,now,member.userId);if(action==='member.remove')for(const robot of db.robots)if(robot.organizationId===member.organizationId){robot.assignedUserIds=robot.assignedUserIds.filter(u=>u!==member.userId);db.assignments=db.assignments.filter(a=>a.organizationId!==member.organizationId||a.userId!==member.userId);}
      touch(member,now);touch(user,now);result=member.id;break;
    }
    case 'invitation.revoke':case 'invitation.regenerate':{
      const invite=find(db.invitations,id,'Invitation');if(role==='ADMIN'&&invite.role!=='USER')throw new Error('Admins cannot alter Owner or Admin invitations.');invite.status='revoked';invite.revokedAt=now;touch(invite,now);
      if(invite.redeemedSessionId){const session=db.sessions.find(s=>s.id===invite.redeemedSessionId);if(session){session.status='revoked';touch(session,now);const robot=db.robots.find(r=>r.id===session.robotId);if(robot&&db.grants.some(g=>g.sessionId===session.id&&['pending','granted'].includes(g.status)))revokeRobot(db,robot,now);}}
      result=action==='invitation.regenerate'?createInvitation(db,actor,{...invite,expiresAt:now+7*86400000},invite.organizationId,now).id:invite.id;break;
    }
    case 'invitation.accept':{
      const invite=db.invitations.find(i=>i.token===p.token);if(!invite)throw new Error('Unknown demo invitation. Records from another browser are unavailable here.');
      if(invite.status!=='pending')throw new Error(`Invitation is ${invite.status}.`);if(invite.expiresAt<=now)throw new Error('Invitation expired.');
      const user=find(db.users,actor.userId,'User');if(user.email.toLowerCase()!==invite.invitee.toLowerCase())throw new Error('Wrong recipient: switch to the invited demo identity.');
      if(actor.organizationId&&actor.organizationId!==invite.organizationId)throw new Error('Wrong tenant: leave the current organization before accepting.');
      const o=find(db.organizations,invite.organizationId,'Organization');if(o.status!=='active')throw new Error('Organization is not active.');
      if(invite.kind==='membership'){
        let member=db.memberships.find(m=>m.organizationId===o.id&&m.userId===user.id);
        if(member?.role==='OWNER'&&invite.role!=='OWNER')throw new Error('Invitation cannot demote an existing Owner.');
        if(invite.role==='OWNER'){
          if(o.ownerId!==user.id&&db.memberships.some(m=>m.organizationId===o.id&&m.role==='OWNER'&&m.status==='active'))throw new Error('An explicit Owner transfer is required.');o.ownerId=user.id;
        }
        if(!member){if(db.memberships.filter(m=>m.organizationId===o.id&&m.status==='active').length>=o.quotas.users)throw new Error('Membership quota reached.');member={...base('member',now),organizationId:o.id,userId:user.id,role:invite.role,status:'active',capabilities:invite.capabilities};db.memberships.push(member);}else{if(member.role!==invite.role)throw new Error('Existing membership roles must be changed by an authorized manager.');member.status='active';member.capabilities=invite.capabilities;}
        for(const robotId of invite.robotIds){const robot=find(db.robots,robotId,'Robot');if(robot.organizationId!==o.id||robot.status!=='active')throw new Error('Invited robot is unavailable.');if(!robot.assignedUserIds.includes(user.id))robot.assignedUserIds.push(user.id);if(!db.assignments.some(a=>a.robotId===robot.id&&a.userId===user.id))db.assignments.push({...base('assignment',now),organizationId:o.id,robotId:robot.id,userId:user.id,capabilities:invite.capabilities});}
        result=member.id;
      }else{
        const member=db.memberships.find(m=>m.userId===user.id&&m.organizationId===o.id&&m.status==='active');if(!member)throw new Error('Accept a membership invitation before redeeming a session invitation.');
        const robot=find(db.robots,invite.robotIds[0],'Robot');if(robot.organizationId!==o.id)throw new Error('Wrong-tenant robot invitation.');
        if(member.role==='USER'&&!robot.assignedUserIds.includes(user.id))robot.assignedUserIds.push(user.id);
        if(!db.assignments.some(a=>a.robotId===robot.id&&a.userId===user.id))db.assignments.push({...base('assignment',now),organizationId:o.id,robotId:robot.id,userId:user.id,capabilities:invite.capabilities});
        const session=makeSession(db,{...actor,organizationId:o.id},robot,{capabilities:invite.capabilities,expiresAt:Math.min(invite.expiresAt,now+30*60000)},now);session.invitationId=invite.id;invite.redeemedSessionId=session.id;result=session.id;
      }
      invite.status='accepted';invite.acceptedBy=user.id;invite.acceptedAt=now;touch(invite,now);organizationId=o.id;break;
    }
    case 'robot.create':{
      const o=org();if(db.robots.filter(r=>r.organizationId===o.id&&r.status!=='archived').length>=o.quotas.robots)throw new Error('Robot quota reached.');
      const serial=text(p.serial,'serial',64),deviceId=text(p.deviceId??uid('FD'),'device ID',100);if(db.robots.some(r=>r.serial===serial||r.deviceId===deviceId))throw new Error('Robot serial and device ID must be unique.');
      const floor=find(db.floors,p.floorId,'Floor');if(floor.organizationId!==o.id)throw new Error('Robot floor belongs to another organization.');
      const robot:Robot={...base('robot',now),organizationId:o.id,name:text(p.name,'robot name'),serial,deviceId,floorId:floor.id,locationId:floor.locationId,connectivity:'offline',mode:'welcome',fault:null,battery:100,x:25,y:55,heading:0,pairing:'code_pending',pairingCode:String(Math.floor(100000+Math.random()*900000)),pairingExpiresAt:now+5*60000,credentialGeneration:1,status:'active',assignedUserIds:[],capabilities:['video','chat','screen','control','simulated_navigation'],agentVersion:'demo-1.0.0',firmwareVersion:'sim-1.2.4',estop:false,generation:1,stopState:'acknowledged',telemetry:{timestamp:now,linear:0,angular:0,leftWheel:0,rightWheel:0,wheelRadius:0.08,trackWidth:0.42,latency:38,signal:92,temperature:32,voltage:null,current:null,serialConnected:false,surfaceConnected:false,camera:false,microphone:false,obstacle:false}};db.robots.push(robot);result=robot.id;break;
    }
    case 'robot.update':case 'robot.suspend':case 'robot.archive':case 'robot.pair':case 'robot.unpair':case 'robot.rotate':case 'robot.test':case 'robot.activate':case 'robot.assign':case 'robot.unassign':{
      const robot=find(db.robots,id,'Robot');
      if(action==='robot.assign'||action==='robot.unassign'){
        const user=find(db.users,p.userId,'User');if(!db.memberships.some(m=>m.userId===user.id&&m.organizationId===robot.organizationId&&m.status==='active'))throw new Error('Assign an active member of this organization.');
        if(action==='robot.assign'){const member=db.memberships.find(m=>m.userId===user.id&&m.organizationId===robot.organizationId&&m.status==='active')!;const capabilities=p.capabilities===undefined?['video','chat','screen','control'].filter(c=>member.capabilities.includes(c)):strings(p.capabilities);if(capabilities.some(c=>!['video','chat','screen','control'].includes(c)||!member.capabilities.includes(c)))throw new Error('Assignment capabilities exceed this member’s permissions.');if(!robot.assignedUserIds.includes(user.id))robot.assignedUserIds.push(user.id);const prior=db.assignments.find(a=>a.robotId===robot.id&&a.userId===user.id);if(prior){prior.capabilities=capabilities;touch(prior,now);invalidate(db,robot.organizationId,now,user.id,robot.id);}else db.assignments.push({...base('assignment',now),organizationId:robot.organizationId,robotId:robot.id,userId:user.id,capabilities});}
        else{robot.assignedUserIds=robot.assignedUserIds.filter(u=>u!==user.id);db.assignments=db.assignments.filter(a=>a.robotId!==robot.id||a.userId!==user.id);invalidate(db,robot.organizationId,now,user.id,robot.id);}
      }else if(action==='robot.pair'){
        if(p.organizationId&&p.organizationId!==robot.organizationId)throw new Error('Wrong organization pairing.');if(robot.pairing!=='code_pending'||(robot.pairingExpiresAt??0)<=now)throw new Error('Pairing code expired or unavailable. Rotate credentials to generate a new code.');if(String(p.code??p.pairingCode)!==robot.pairingCode)throw new Error('Incorrect simulated pairing code.');robot.pairing='paired';delete robot.pairingCode;delete robot.pairingExpiresAt;
      }else if(action==='robot.rotate'){invalidate(db,robot.organizationId,now,undefined,robot.id);robot.credentialGeneration++;robot.pairing='code_pending';robot.pairingCode=String(Math.floor(100000+Math.random()*900000));robot.pairingExpiresAt=now+5*60000;robot.connectivity='offline';}
      else if(action==='robot.unpair'){invalidate(db,robot.organizationId,now,undefined,robot.id);robot.pairing='revoked';robot.connectivity='offline';robot.telemetry.serialConnected=false;robot.telemetry.surfaceConnected=false;}
      else if(action==='robot.test'||action==='robot.activate'){if(robot.pairing!=='paired')throw new Error('Complete simulated pairing first.');robot.connectivity='online';robot.telemetry.serialConnected=true;robot.telemetry.surfaceConnected=true;robot.telemetry.camera=true;robot.telemetry.microphone=true;robot.telemetry.timestamp=now;}
      else{
        if(p.name!==undefined)robot.name=text(p.name,'robot name');
        if(p.floorId!==undefined){const floor=find(db.floors,p.floorId,'Floor');if(floor.organizationId!==robot.organizationId)throw new Error('Wrong-tenant floor.');robot.floorId=floor.id;robot.locationId=floor.locationId;invalidate(db,robot.organizationId,now,undefined,robot.id);}
        if(p.mode!==undefined){if(!['welcome','telepresence','charging','maintenance'].includes(String(p.mode)))throw new Error('Invalid robot operating mode.');robot.mode=p.mode as Robot['mode'];if(['maintenance','charging'].includes(robot.mode))invalidate(db,robot.organizationId,now,undefined,robot.id);}
        if(p.maintenanceAt!==undefined)robot.maintenanceAt=number(p.maintenanceAt,'maintenance date',now,now+365*86400000);
        if(p.reboot)invalidate(db,robot.organizationId,now,undefined,robot.id);
        const status=action==='robot.suspend'?'suspended':action==='robot.archive'?'archived':p.status;
        if(status!==undefined){if(!['active','suspended','archived'].includes(String(status)))throw new Error('Invalid robot lifecycle.');robot.status=status as Robot['status'];if(status!=='active')invalidate(db,robot.organizationId,now,undefined,robot.id);}
      }
      touch(robot,now);result=robot.id;break;
    }
    case 'session.create':{const robot=find(db.robots,p.robotId,'Robot');if(robot.organizationId!==org().id)throw new Error('Wrong-tenant robot.');result=makeSession(db,actor,robot,p,now).id;break;}
    case 'session.join':case 'session.status':case 'session.end':{
      const session=find(db.sessions,id,'Session');sessionAllowed(db,actor,session);
      if(action==='session.end'){session.status='ended';revokeRobot(db,find(db.robots,session.robotId,'Robot'),now);}
      else{if(session.expiresAt<=now||['expired','revoked','ended','rejected'].includes(session.status))throw new Error('Session is no longer available.');if(action==='session.join'){session.status='connected';if(!session.participantIds.includes(actor.userId))session.participantIds.push(actor.userId);}else{const allowed=['waiting','ringing','connecting','connected','rejected','busy','reconnecting','disconnected'];if(!allowed.includes(String(p.status)))throw new Error('Invalid session status.');session.status=p.status as Session['status'];if(session.status!=='connected')revokeRobot(db,find(db.robots,session.robotId,'Robot'),now);}}
      touch(session,now);result=session.id;break;
    }
    case 'control.request':{
      const session=find(db.sessions,p.sessionId??id,'Session');sessionAllowed(db,actor,session);if(session.status!=='connected'||session.expiresAt<=now||!session.capabilities.includes('control'))throw new Error('A connected session with control-request permission is required.');
      const robot=find(db.robots,session.robotId,'Robot');if(robot.estop||robot.fault||robot.status!=='active'||robot.connectivity!=='online'||!robot.telemetry.serialConnected)throw new Error('Robot is not ready for simulated control.');
      const existing=db.grants.find(g=>g.sessionId===session.id&&g.operatorId===actor.userId&&['pending','granted'].includes(g.status));if(existing){result=existing.id;break;}
      const grant={...base('grant',now),organizationId:session.organizationId,robotId:session.robotId,sessionId:session.id,operatorId:actor.userId,status:'pending' as const,leaseId:uid('lease'),generation:robot.generation,expiresAt:Math.min(session.expiresAt,now+30000),lastSequence:0,capabilities:['control']};db.grants.push(grant);result=grant.id;
      const o=find(db.organizations,robot.organizationId,'Organization');if(!o.approvalRequired&&!db.grants.some(g=>g.id!==grant.id&&g.robotId===robot.id&&g.status==='granted'&&g.expiresAt>now)){(grant as {status:string}).status='granted';robot.generation++;grant.generation=robot.generation;}
      break;
    }
    case 'control.approve':case 'control.deny':case 'control.revoke':case 'control.release':{
      const grant=find(db.grants,id,'Control request'),robot=find(db.robots,grant.robotId,'Robot'),session=find(db.sessions,grant.sessionId,'Session');
      if(action==='control.release'){if(role==='USER'&&grant.operatorId!==actor.userId)throw new Error('You may release only your own lease.');if(!['granted','pending'].includes(grant.status)){result=grant.id;break;}grant.status='revoked';zeroRobot(robot);robot.generation++;}
      else if(action==='control.approve'){
        if(grant.status!=='pending'||grant.expiresAt<=now||session.status!=='connected'||session.expiresAt<=now)throw new Error('Control request expired or session is unavailable.');
        if(db.grants.some(g=>g.id!==grant.id&&g.robotId===robot.id&&g.status==='granted'&&g.expiresAt>now))throw new Error('Another operator owns this robot. Revoke their lease before takeover.');
        if(robot.status!=='active'||robot.estop||robot.fault||robot.connectivity!=='online'||!robot.telemetry.serialConnected||!robot.telemetry.surfaceConnected||robot.pairing!=='paired'||robot.mode==='maintenance'||robot.mode==='charging'||robot.telemetry.obstacle)throw new Error('Robot safety state blocks control.');
        const operator=db.users.find(u=>u.id===grant.operatorId&&u.status==='active'),membership=db.memberships.find(m=>m.userId===grant.operatorId&&m.organizationId===robot.organizationId&&m.status==='active');if(!operator||(!operator.platformRole&&!membership)||membership?.role==='USER'&&!robot.assignedUserIds.includes(grant.operatorId))throw new Error('Operator access was revoked.');
        robot.generation++;grant.generation=robot.generation;grant.status='granted';grant.expiresAt=Math.min(session.expiresAt,now+30000);grant.lastSequence=0;zeroRobot(robot);for(const mission of db.missions)if(mission.robotId===robot.id&&mission.status==='running')mission.status='paused';
      }else {grant.status=action==='control.deny'?'denied':'revoked';if(action==='control.revoke')revokeRobot(db,robot,now);}
      touch(grant,now);result=grant.id;break;
    }
    case 'control.command':applyCommand(db,actor,p.command??p,now);result=(p.command as {robotId?:string})?.robotId;break;
    case 'control.halt':case 'control.stop':case 'control.estop':case 'control.reset':{
      let robots:Robot[];
      if(p.all){if(role==='USER')throw new Error('Users cannot stop an organization fleet.');robots=db.robots.filter(r=>!organizationId||r.organizationId===organizationId);}
      else robots=[find(db.robots,p.robotId??id,'Robot')];
      for(const robot of robots){robotAllowed(db,actor,robot);if(role==='USER'){const session=db.sessions.find(s=>s.robotId===robot.id&&s.organizationId===robot.organizationId&&s.status==='connected'&&s.expiresAt>now&&(s.userId===actor.userId||s.participantIds.includes(actor.userId)));if(!session)throw new Error('Stop requires your authorized active session.');}
        if(action==='control.reset'){robot.estop=false;zeroRobot(robot);robot.generation++;}else{robot.stopState=robot.connectivity==='online'&&robot.telemetry.serialConnected?'acknowledged':'unavailable';if(action==='control.halt'){zeroRobot(robot);for(const grant of db.grants)if(grant.robotId===robot.id&&grant.status==='granted'){grant.lastSequence++;grant.commandDeadline=now;grant.haltedAt=now;touch(grant,now);}}else revokeRobot(db,robot,now);if(action==='control.estop')robot.estop=true;for(const mission of db.missions)if(mission.robotId===robot.id&&['queued','running'].includes(mission.status))mission.status='paused';}touch(robot,now);
      }result=robots[0]?.id??organizationId;break;
    }
    case 'chat.send':{
      const session=find(db.sessions,p.sessionId,'Session');sessionAllowed(db,actor,session);if(session.expiresAt<=now||['expired','revoked','ended'].includes(session.status)||!session.capabilities.includes('chat'))throw new Error('Chat is unavailable for this session.');
      if(p.channel!=='admin'&&p.channel!=='robot')throw new Error('Unknown conversation channel.');if(p.simulateFailure!==undefined&&typeof p.simulateFailure!=='boolean')throw new Error('Invalid demo delivery failure setting.');
      const message:Database['messages'][number]={...base('message',now),organizationId:session.organizationId,sessionId:session.id,channel:p.channel,userId:actor.userId,text:text(p.text,'message',2000),status:p.simulateFailure?'failed':'pending',readBy:[actor.userId]};db.messages.push(message);result=message.id;break;
    }
    case 'chat.retry':{const message=find(db.messages,id,'Message');const session=find(db.sessions,message.sessionId,'Session');sessionAllowed(db,actor,session);if(message.userId!==actor.userId)throw new Error('Retry your own messages only.');if(session.expiresAt<=now||['expired','revoked','ended'].includes(session.status)||!session.capabilities.includes('chat'))throw new Error('Chat is unavailable for this session.');if(message.status!=='failed')throw new Error('Only a failed message can be retried.');message.status='pending';touch(message,now);result=message.id;break;}
    case 'chat.read':{const session=find(db.sessions,p.sessionId,'Session');sessionAllowed(db,actor,session);if(p.channel!=='admin'&&p.channel!=='robot')throw new Error('Unknown conversation channel.');if(!session.capabilities.includes('chat'))throw new Error('This session does not permit chat.');for(const message of db.messages)if(message.sessionId===session.id&&message.organizationId===session.organizationId&&message.channel===p.channel&&message.status==='delivered'&&!message.readBy.includes(actor.userId)){message.readBy.push(actor.userId);touch(message,now);}result=session.id;break;}
    case 'location.create':case 'floor.create':{
      const o=org();if(action==='location.create'){if(db.locations.filter(l=>l.organizationId===o.id).length>=o.quotas.branches)throw new Error('Branch quota reached.');const location={...base('location',now),organizationId:o.id,name:text(p.name,'branch name'),address:text(p.address??'Demo address','address')};db.locations.push(location);result=location.id;}
      else{const location=find(db.locations,p.locationId,'Location');if(location.organizationId!==o.id)throw new Error('Wrong-tenant location.');const floor={...base('floor',now),organizationId:o.id,locationId:location.id,name:text(p.name,'floor name')};db.floors.push(floor);result=floor.id;}break;
    }
    case 'location.update':case 'floor.update':{const record=action==='location.update'?find(db.locations,id,'Location'):find(db.floors,id,'Floor');if(p.name!==undefined)record.name=text(p.name,'name');if(action==='location.update'&&p.address!==undefined)(record as Database['locations'][number]).address=text(p.address,'address');touch(record,now);result=record.id;break;}
    case 'location.delete':{const location=find(db.locations,id,'Location');if(db.floors.some(f=>f.locationId===location.id))throw new Error('Delete or move the branch floors first.');db.locations=db.locations.filter(l=>l.id!==location.id);result=location.id;break;}
    case 'floor.delete':{const floor=find(db.floors,id,'Floor');if(db.robots.some(r=>r.floorId===floor.id)||db.maps.some(m=>m.floorId===floor.id)||db.points.some(p=>p.floorId===floor.id))throw new Error('Move robots and delete floor maps/points first.');db.floors=db.floors.filter(f=>f.id!==floor.id);result=floor.id;break;}
    case 'map.create':{
      const floor=find(db.floors,p.floorId,'Floor');if(floor.organizationId!==org().id)throw new Error('Wrong-tenant floor.');const map={...base('map',now),organizationId:floor.organizationId,floorId:floor.id,name:text(p.name,'map name'),active:false,version:1+db.maps.filter(m=>m.floorId===floor.id).length,coordinates:'percent' as const,...(p.blob instanceof Blob?{blob:p.blob}:{})};db.maps.push(map);result=map.id;break;
    }
    case 'map.update':case 'map.activate':case 'map.delete':{
      const map=find(db.maps,id,'Map');if(action==='map.delete'){db.maps=db.maps.filter(m=>m.id!==map.id);}else if(action==='map.activate'){for(const other of db.maps)if(other.floorId===map.floorId)other.active=other.id===map.id;}else{if(p.name!==undefined)map.name=text(p.name,'map name');if(p.blob instanceof Blob)map.blob=p.blob;if(p.scale!==undefined)map.scale=number(p.scale,'scale in meters per map unit',0.001,1000);if(p.origin!==undefined){const o=p.origin as unknown[];if(!Array.isArray(o)||o.length!==2)throw new Error('Map origin requires x and y.');map.origin=[number(o[0],'origin x'),number(o[1],'origin y')];}map.version++;}touch(map,now);result=map.id;break;
    }
    case 'point.create':{const floor=find(db.floors,p.floorId,'Floor');if(floor.organizationId!==org().id)throw new Error('Wrong-tenant floor.');const point={...base('point',now),organizationId:floor.organizationId,floorId:floor.id,name:text(p.name,'point name'),category:text(p.category??'service','category'),x:number(p.x,'x'),y:number(p.y,'y')};db.points.push(point);result=point.id;break;}
    case 'point.update':case 'point.delete':{const point=find(db.points,id,'Map point');if(action==='point.delete'){for(const mission of db.missions)if(mission.pointId===point.id&&!['completed','canceled','failed'].includes(mission.status)){mission.status='canceled';const robot=db.robots.find(r=>r.id===mission.robotId);if(robot)zeroRobot(robot);}db.points=db.points.filter(p=>p.id!==point.id);}else{if(p.name!==undefined)point.name=text(p.name,'point name');if(p.category!==undefined)point.category=text(p.category,'category');if(p.x!==undefined)point.x=number(p.x,'x');if(p.y!==undefined)point.y=number(p.y,'y');touch(point,now);}result=point.id;break;}
    case 'mission.create':{
      const robot=find(db.robots,p.robotId,'Robot'),point=find(db.points,p.pointId,'Map point');if(robot.organizationId!==org().id||point.organizationId!==org().id||point.floorId!==robot.floorId)throw new Error('Mission robot and destination must share this organization and floor.');
      if(db.missions.some(m=>m.robotId===robot.id&&['queued','running','paused'].includes(m.status)))throw new Error('Finish or cancel the existing mission first.');
      if(robot.estop||robot.fault||robot.mode==='maintenance'||robot.connectivity!=='online')throw new Error('Robot is unavailable for a mission.');
      const mission={...base('mission',now),organizationId:robot.organizationId,robotId:robot.id,pointId:point.id,status:'queued' as const,eta:Math.ceil(Math.hypot(point.x-robot.x,point.y-robot.y)/2.5),actorId:actor.userId};db.missions.push(mission);result=mission.id;break;
    }
    case 'mission.pause':case 'mission.resume':case 'mission.cancel':{
      const mission=find(db.missions,id,'Mission'),robot=find(db.robots,mission.robotId,'Robot');if(['completed','canceled','failed'].includes(mission.status))throw new Error('Mission has already finished.');
      if(action==='mission.resume'){if(robot.estop||robot.fault||robot.connectivity!=='online'||!robot.telemetry.serialConnected||robot.mode==='maintenance'||robot.mode==='charging'||robot.telemetry.obstacle||db.grants.some(g=>g.robotId===robot.id&&g.status==='granted'))throw new Error('Release manual control and restore robot readiness before resuming.');mission.status='running';}else{mission.status=action==='mission.pause'?'paused':'canceled';zeroRobot(robot);}touch(mission,now);result=mission.id;break;
    }
    case 'knowledge.create':{const source={...base('knowledge',now),organizationId:org().id,title:text(p.title,'knowledge title'),text:text(p.text??'Stored locally; indexing not configured.','knowledge text',20000,true),category:text(p.category??'FAQ','category'),status:'draft' as const,...(typeof p.filename==='string'?{filename:p.filename,indexing:'not_configured' as const}:{}),...(p.blob instanceof Blob?{blob:p.blob,indexing:'not_configured' as const}:{})};db.knowledge.push(source);result=source.id;break;}
    case 'knowledge.update':case 'knowledge.publish':case 'knowledge.archive':{const source=find(db.knowledge,id,'Knowledge source');if(action==='knowledge.publish')source.status='published';else if(action==='knowledge.archive')source.status='archived';else{if(p.title!==undefined)source.title=text(p.title,'knowledge title');if(p.text!==undefined)source.text=text(p.text,'knowledge text',20000,true);if(p.category!==undefined)source.category=text(p.category,'category');source.status='draft';}touch(source,now);result=source.id;break;}
    case 'ticket.create':{const ticket={...base('ticket',now),organizationId,userId:actor.userId,subject:text(p.subject??'Demo support request','ticket subject'),text:text(p.text??'Please assist with this demo.','ticket text',4000),status:'open' as const,...(typeof p.robotId==='string'?{robotId:p.robotId}:{})};if(ticket.robotId){const robot=find(db.robots,ticket.robotId,'Robot');if(robot.organizationId!==organizationId)throw new Error('Wrong-tenant ticket robot.');robotAllowed(db,actor,robot);}db.tickets.push(ticket);result=ticket.id;break;}
    case 'ticket.resolve':{const ticket=find(db.tickets,id,'Ticket');ticket.status='resolved';touch(ticket,now);result=ticket.id;break;}
    case 'notification.read':{const note=find(db.notifications,id,'Notification');if(note.organizationId&&note.organizationId!==org().id||note.userId&&note.userId!==actor.userId)throw new Error('Notification is not permitted.');if(!note.readBy.includes(actor.userId))note.readBy.push(actor.userId);result=note.id;break;}
    case 'update.start':{
      const robot=find(db.robots,p.robotId??id,'Robot');if(robot.organizationId!==org().id)throw new Error('Wrong-tenant update.');invalidate(db,robot.organizationId,now,undefined,robot.id);robot.mode='maintenance';const release={...base('release',now),organizationId:robot.organizationId,robotId:robot.id,name:'Simulated firmware/agent update',version:text(p.version??'sim-1.3.0','version'),status:'installing' as const,progress:0};db.releases.push(release);result=release.id;break;
    }
    case 'update.status':{const release=find(db.releases,id,'Release');if(!['installing','completed','failed'].includes(String(p.status)))throw new Error('Invalid simulated update status.');release.status=p.status as typeof release.status;release.progress=release.status==='completed'?100:p.progress===undefined?release.progress:number(p.progress,'update progress');if(release.status==='completed'&&release.robotId){const robot=find(db.robots,release.robotId,'Robot');zeroRobot(robot);robot.firmwareVersion=release.version;}touch(release,now);result=release.id;break;}
    case 'scenario.apply':{
      const robot=find(db.robots,p.robotId??id,'Robot');if(robot.organizationId!==org().id)throw new Error('Wrong-tenant scenario.');const scenario=p.scenario;
      if(!['offline','serial_disconnect','low_battery','busy','control_revocation','latency','obstacle','update_failure','emergency_stop','restore'].includes(String(scenario)))throw new Error('Unknown demo scenario.');
      revokeRobot(db,robot,now);
      if(scenario==='offline')robot.connectivity='offline';if(scenario==='serial_disconnect')robot.telemetry.serialConnected=false;if(scenario==='low_battery')robot.battery=7;if(scenario==='busy')robot.mode='telepresence';if(scenario==='latency')robot.telemetry.latency=680;if(scenario==='obstacle')robot.telemetry.obstacle=true;if(scenario==='update_failure')robot.fault='Simulated update failed';if(scenario==='emergency_stop')robot.estop=true;
      if(scenario==='restore'){robot.connectivity='online';robot.telemetry.serialConnected=true;robot.telemetry.surfaceConnected=true;robot.telemetry.obstacle=false;robot.telemetry.latency=38;robot.fault=null;robot.battery=87;robot.mode='welcome';robot.telemetry.timestamp=now;/* Emergency stops stay latched until explicit reset. */}
      if(scenario!=='restore')db.incidents.push({...base('incident',now),organizationId:robot.organizationId,robotId:robot.id,severity:['offline','serial_disconnect','obstacle','emergency_stop'].includes(String(scenario))?'critical':'warning',title:`Demo scenario: ${String(scenario).replaceAll('_',' ')}`,status:'open'});result=robot.id;break;
    }
    case 'incident.resolve':{const incident=find(db.incidents,id,'Incident');incident.status='resolved';touch(incident,now);result=incident.id;break;}
    case 'data.export':result=organizationId??'platform';break;
    default:throw new Error('Unknown action; demo authorization is default-deny.');
  }
  {
    const command=action==='control.command'?p.command as {sequence:number;linear:number;angular:number;robotId:string}:undefined;
    db.audits.push({...base('audit',now),organizationId,actorId:actor.userId,role,entityId:result,robotId:command?.robotId??(family==='robot'?result:typeof p.robotId==='string'?p.robotId:undefined),action,severity:['control.estop','organization.suspend','robot.suspend'].includes(action)?'warning':'info',outcome:'success',summary:command?`Accepted simulator command ${command.sequence}: ${command.linear.toFixed(2)} m/s, ${command.angular.toFixed(2)} rad/s.`:`${action} applied to fictional demo records.`});
    if(db.audits.length>1500)db.audits.splice(0,db.audits.length-1500);
  }
  return result;
}

function kioskTool(db:Database,p:Record<string,unknown>,now:number):string {
  const robot=find(db.robots,p.robotId,'Robot'),org=find(db.organizations,robot.organizationId,'Organization');
  if(robot.status!=='active'||robot.pairing!=='paired'||org.status!=='active')throw new Error('Public demo kiosk is unavailable.');
  let result:string;
  if(p.tool==='request_navigation'){
    const point=find(db.points,p.pointId,'Map point');if(point.organizationId!==org.id||point.floorId!==robot.floorId)throw new Error('Public navigation must use a point on this paired robot’s floor.');
    if(db.missions.some(m=>m.robotId===robot.id&&['queued','running','paused'].includes(m.status)))throw new Error('A mission is already pending for this robot.');
    const mission={...base('mission',now),organizationId:org.id,robotId:robot.id,pointId:point.id,status:'queued' as const,eta:Math.ceil(Math.hypot(point.x-robot.x,point.y-robot.y)/2.5),actorId:'kiosk'};db.missions.push(mission);result=mission.id;
  }else if(p.tool==='notify_admin'){
    const note={...base('notification',now),organizationId:org.id,title:'Demo kiosk requested human help',text:text(p.text??'A visitor requested help at '+robot.name,'help request',1000),href:'/robots/'+robot.id,readBy:[]};db.notifications.push(note);result=note.id;
  }else if(p.tool==='create_support_ticket'||p.tool==='start_video_call'){
    const ticket={...base('ticket',now),organizationId:org.id,userId:'kiosk',robotId:robot.id,subject:p.tool==='start_video_call'?'Simulated kiosk video help request':'Demo kiosk support request',text:text(p.text??'A fictional visitor requested human assistance. No external call is connected.','ticket text',2000),status:'open' as const};db.tickets.push(ticket);result=ticket.id;
  }else throw new Error('This public tool is unavailable. Public kiosks cannot grant control or access management.');
  db.audits.push({...base('audit',now),organizationId:org.id,actorId:'kiosk',role:'GUEST',entityId:result,robotId:robot.id,action:'kiosk.'+String(p.tool),severity:'info',outcome:'success',summary:'Paired public kiosk created a local demo help/mission request.'});return result;
}
