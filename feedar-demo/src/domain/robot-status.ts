import type {ControlGrant,Database,Robot} from './models';

const activeSessionStatuses=new Set(['connected']);

export function robotControlStatus(db:Database,robot:Robot,now=Date.now()){
 const organization=db.organizations.find(o=>o.id===robot.organizationId);
 const ready=organization?.status==='active'&&robot.status==='active'&&robot.connectivity==='online'&&robot.pairing==='paired'&&!robot.fault&&!robot.estop&&!robot.telemetry.obstacle&&robot.telemetry.serialConnected&&robot.telemetry.surfaceConnected&&!['maintenance','charging'].includes(robot.mode);
 const controls=db.grants.filter(g=>g.robotId===robot.id&&g.organizationId===robot.organizationId);
 const valid=(grant:ControlGrant)=>{
  if(grant.status!=='granted'||grant.expiresAt<=now||grant.generation!==robot.generation||!ready)return false;
  const session=db.sessions.find(s=>s.id===grant.sessionId);
  if(!session||session.robotId!==robot.id||session.organizationId!==robot.organizationId||!activeSessionStatuses.has(session.status)||session.expiresAt<=now||!session.participantIds.includes(grant.operatorId))return false;
  const user=db.users.find(u=>u.id===grant.operatorId&&u.status==='active');if(!user)return false;
  if(user.platformRole==='BOSS')return true;
  const membership=db.memberships.find(m=>m.userId===user.id&&m.organizationId===robot.organizationId&&m.status==='active');
  return !!membership&&(membership.role!=='USER'||robot.assignedUserIds.includes(user.id));
 };
 const current=controls.find(valid);
 const history=controls.filter(g=>g.id!==current?.id&&(g.grantedAt!==undefined||g.status==='granted'||g.lastSequence>0)).sort((a,b)=>(b.grantedAt??b.createdAt)-(a.grantedAt??a.createdAt));
 const last=history[0];
 const sessionWorking=db.sessions.some(s=>s.robotId===robot.id&&s.organizationId===robot.organizationId&&s.status==='connected'&&s.expiresAt>now);
 const missionWorking=db.missions.some(m=>m.robotId===robot.id&&m.status==='running');
 return {currentGrant:current,currentUserId:current?.operatorId,lastUserId:last?.operatorId,availability:current?'Busy':ready?'Available':'Unavailable',activity:sessionWorking?'Working · telepresence':missionWorking?'Working · mission':'Idle',connectable:ready&&!current};
}
