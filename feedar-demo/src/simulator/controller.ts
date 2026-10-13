import type { Actor, ControlGrant, Database, Robot, RobotCommand } from '../domain/models';
import { answerFromKnowledge } from '../domain/assistant';
export const SIMULATION_GEOMETRY = { trackWidth:0.42, wheelRadius:0.08, percentPerMeter:5 };
export function zeroRobot(robot:Robot):void {robot.telemetry.linear=0;robot.telemetry.angular=0;robot.telemetry.leftWheel=0;robot.telemetry.rightWheel=0;}
export function revokeRobot(db:Database,robot:Robot,now:number,status:'revoked'|'expired'='revoked'):void {
  zeroRobot(robot);robot.generation++;robot.updatedAt=now;
  for(const grant of db.grants) if(grant.robotId===robot.id&&['granted','pending'].includes(grant.status)){grant.status=status;grant.updatedAt=now;}
}
export function validateCommand(db:Database,actor:Actor,input:unknown,now:number):{robot:Robot;grant:ControlGrant;command:RobotCommand} {
  if(!input||typeof input!=='object') throw new Error('Malformed command envelope.');
  const c=input as RobotCommand;
  const numbers=[c.generation,c.sequence,c.linear,c.angular,c.issuedAt,c.deadline,c.ttl];
  if(c.version!==1||numbers.some(n=>typeof n!=='number'||!Number.isFinite(n))||!Number.isInteger(c.sequence)||c.sequence<1||!Number.isInteger(c.generation)||typeof c.leaseId!=='string')throw new Error('Malformed or non-finite command envelope.');
  if(c.ttl<1||c.ttl>500||c.deadline>c.issuedAt+c.ttl||c.deadline<=now||c.issuedAt>now+50||now-c.issuedAt>c.ttl)throw new Error('Expired or invalid command deadline.');
  const robot=db.robots.find(r=>r.id===c.robotId),session=db.sessions.find(s=>s.id===c.sessionId),grant=db.grants.find(g=>g.leaseId===c.leaseId&&g.status==='granted');
  if(!robot||!session||!grant||robot.organizationId!==c.organizationId||session.organizationId!==c.organizationId||grant.organizationId!==c.organizationId||session.robotId!==robot.id||grant.robotId!==robot.id||grant.sessionId!==session.id||grant.operatorId!==actor.userId||(!session.participantIds.includes(actor.userId)&&session.userId!==actor.userId)||grant.generation!==c.generation||robot.generation!==c.generation)throw new Error('Command lease, tenant, session, or operator mismatch.');
  if(actor.organizationId&&actor.organizationId!==c.organizationId)throw new Error('Wrong tenant.');
  if(session.status!=='connected'||session.expiresAt<=now||grant.expiresAt<=now||!session.capabilities.includes('control')||!grant.capabilities.includes('control'))throw new Error('Control authorization expired or unavailable.');
  const user=db.users.find(u=>u.id===actor.userId&&u.status==='active'),membership=db.memberships.find(m=>m.organizationId===c.organizationId&&m.userId===actor.userId&&m.status==='active');
  if(!user||(!user.platformRole&&!membership)||membership?.role==='USER'&&!robot.assignedUserIds.includes(actor.userId))throw new Error('Assignment or membership revoked.');
  const assignment=db.assignments.find(a=>a.robotId===robot.id&&a.userId===actor.userId&&a.organizationId===robot.organizationId);
  if(membership?.role==='USER'&&(!membership.capabilities.includes('control')||assignment&&!assignment.capabilities.includes('control')))throw new Error('Membership or assignment control capability revoked.');
  if(c.sequence<=grant.lastSequence)throw new Error('Duplicate or out-of-order command.');
  if(grant.haltedAt!==undefined&&c.issuedAt<=grant.haltedAt)throw new Error('Command was issued before the latest input-release stop barrier.');
  const org=db.organizations.find(o=>o.id===robot.organizationId&&o.status==='active');
  if(!org||robot.status!=='active'||robot.connectivity!=='online'||robot.pairing!=='paired'||!robot.telemetry.serialConnected||!robot.telemetry.surfaceConnected||robot.estop||robot.fault||robot.telemetry.obstacle||['maintenance','charging'].includes(robot.mode)||now-robot.telemetry.timestamp>1500)throw new Error('Simulated motion blocked by unsafe robot state.');
  if(Math.abs(c.linear)>Math.min(0.5,org.speedLimit)||Math.abs(c.angular)>1.5)throw new Error('Command exceeds demonstration velocity limits.');
  return {robot,grant,command:c};
}
export function applyCommand(db:Database,actor:Actor,input:unknown,now:number):void {
  const{robot,grant,command:c}=validateCommand(db,actor,input,now);
  grant.lastSequence=c.sequence;grant.commandDeadline=c.deadline;grant.updatedAt=now;
  robot.telemetry.linear=c.linear;robot.telemetry.angular=c.angular;
  const width=robot.telemetry.trackWidth;
  robot.telemetry.leftWheel=c.linear-c.angular*width/2;robot.telemetry.rightWheel=c.linear+c.angular*width/2;
  robot.updatedAt=now;
}
export function tickSimulation(db:Database,now:number,elapsedMs:number):void {
  const dt=Math.min(0.1,Math.max(0,elapsedMs/1000));
  for(const release of db.releases)if(release.status==='installing'&&release.robotId){
    const robot=db.robots.find(r=>r.id===release.robotId);
    if(!robot){release.status='failed';continue;}
    zeroRobot(robot);
    if(robot.fault?.includes('update failed')){release.status='failed';release.updatedAt=now;release.revision++;continue;}
    release.progress=Math.min(100,Math.floor((now-release.createdAt)/60));
    if(release.progress>=100){release.status='completed';release.updatedAt=now;release.revision++;robot.firmwareVersion=release.version;db.audits.push({id:`audit-update-${release.id}`,createdAt:now,updatedAt:now,revision:1,organizationId:robot.organizationId,actorId:'simulator',role:'GUEST',entityId:release.id,robotId:robot.id,action:'update.completed',severity:'info',outcome:'success',summary:'Simulated update completed locally; no hardware firmware was installed.'});}
  }
  for(const invitation of db.invitations)if(invitation.status==='pending'&&invitation.expiresAt<=now){invitation.status='expired';invitation.updatedAt=now;invitation.revision++;}
  for(const robot of db.robots)if(robot.pairing==='code_pending'&&(robot.pairingExpiresAt??0)<=now){robot.pairing='expired';robot.updatedAt=now;robot.revision++;}
  for(const session of db.sessions)if(session.expiresAt<=now&&!['ended','expired','revoked','rejected'].includes(session.status)){session.status='expired';const robot=db.robots.find(r=>r.id===session.robotId);if(robot)revokeRobot(db,robot,now,'expired');}
  for(const message of db.messages)if(message.status==='pending'&&now-message.updatedAt>=300){
    const session=db.sessions.find(s=>s.id===message.sessionId&&s.organizationId===message.organizationId);
    const organization=db.organizations.find(o=>o.id===message.organizationId&&o.status==='active');
    if(!session||!organization||session.expiresAt<=now||['ended','expired','revoked'].includes(session.status)){message.status='failed';message.updatedAt=now;message.revision++;continue;}
    message.status='delivered';message.updatedAt=now;message.revision++;
    if(message.channel==='robot'&&!message.simulated){
      const answer=answerFromKnowledge(db,organization.id,message.text,organization.language);
      db.messages.push({id:`reply-${message.id}`,createdAt:now,updatedAt:now,revision:1,organizationId:organization.id,sessionId:session.id,channel:'robot',userId:'demo-assistant',text:answer.text,references:answer.references,status:'delivered',simulated:true,readBy:[]});
    }
  }
  for(const robot of db.robots){
    const grants=db.grants.filter(g=>g.robotId===robot.id&&g.status==='granted');
    if(grants.some(g=>g.expiresAt<=now)){revokeRobot(db,robot,now,'expired');}
    if(robot.connectivity!=='online'||robot.status!=='active'||robot.pairing!=='paired'||robot.fault||robot.estop||robot.telemetry.obstacle||!robot.telemetry.serialConnected||!robot.telemetry.surfaceConnected||['maintenance','charging'].includes(robot.mode)){
      if(grants.length||robot.telemetry.linear||robot.telemetry.angular)revokeRobot(db,robot,now);
      for(const mission of db.missions)if(mission.robotId===robot.id&&mission.status==='running')mission.status='paused';
      continue;
    }
    if(grants.some(g=>(g.commandDeadline??0)<=now)){zeroRobot(robot);}
    const mission=db.missions.find(m=>m.robotId===robot.id&&m.status==='running');
    if(mission&&!db.grants.some(g=>g.robotId===robot.id&&g.status==='granted')){
      const point=db.points.find(p=>p.id===mission.pointId);
      if(!point||point.floorId!==robot.floorId){mission.status='failed';zeroRobot(robot);continue;}
      const dx=point.x-robot.x,dy=point.y-robot.y,distance=Math.hypot(dx,dy);
      if(distance<0.6){robot.x=point.x;robot.y=point.y;mission.status='completed';mission.eta=0;zeroRobot(robot);}
      else {const move=Math.min(distance,dt*2.5);robot.x+=dx/distance*move;robot.y+=dy/distance*move;robot.heading=Math.atan2(dy,dx);mission.eta=Math.ceil(distance/2.5);}
    }else{
      robot.heading+=robot.telemetry.angular*dt;
      robot.x=Math.max(2,Math.min(98,robot.x+Math.cos(robot.heading)*robot.telemetry.linear*dt*SIMULATION_GEOMETRY.percentPerMeter));
      robot.y=Math.max(2,Math.min(98,robot.y+Math.sin(robot.heading)*robot.telemetry.linear*dt*SIMULATION_GEOMETRY.percentPerMeter));
    }
    robot.telemetry.timestamp=now;
  }
}
