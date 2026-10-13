import type { Actor, Database, Role } from './models';

export const ACTIONS = ['organization.create','organization.update','organization.suspend','organization.reactivate','organization.archive','organization.delete','organization.transferOwner','organization.support','member.invite','member.update','member.suspend','member.reactivate','member.remove','invitation.create','invitation.revoke','invitation.regenerate','invitation.accept','robot.create','robot.update','robot.assign','robot.unassign','robot.suspend','robot.archive','robot.pair','robot.unpair','robot.rotate','robot.test','robot.activate','session.create','session.join','session.status','session.end','control.request','control.approve','control.deny','control.release','control.revoke','control.command','control.halt','control.stop','control.estop','control.reset','chat.send','chat.retry','chat.read','map.create','map.update','map.activate','map.delete','point.create','point.update','point.delete','mission.create','mission.pause','mission.resume','mission.cancel','knowledge.create','knowledge.update','knowledge.publish','knowledge.archive','ticket.create','ticket.resolve','notification.read','update.start','update.status','scenario.apply','incident.resolve','location.create','location.update','location.delete','floor.create','floor.update','floor.delete','data.export'] as const;
export type Action = typeof ACTIONS[number];
const isAction = (action: string): action is Action => (ACTIONS as readonly string[]).includes(action);
export function roleFor(db: Database, actor: Actor, organizationId = actor.organizationId): Role {
  const user = db.users.find(u => u.id === actor.userId && u.status === 'active');
  if (!user) return 'GUEST';
  if (user.platformRole === 'BOSS') return 'BOSS';
  const membership = db.memberships.find(m => m.userId === user.id && m.organizationId === organizationId && m.status === 'active');
  const organization = db.organizations.find(o => o.id === organizationId && o.status === 'active');
  return membership && organization ? membership.role : 'GUEST';
}
export function can(db: Database, actor: Actor, action: string, organizationId = actor.organizationId): boolean {
  if (!isAction(action)) return false;
  const user = db.users.find(u => u.id === actor.userId && u.status === 'active');
  if (!user) return false;
  if (action === 'invitation.accept') return true;
  const role = roleFor(db, actor, organizationId);
  if (role === 'BOSS') return true;
  if (actor.organizationId && organizationId !== actor.organizationId) return false;
  if (role === 'GUEST') return false;
  if (['organization.create','organization.suspend','organization.reactivate','organization.archive','organization.delete','organization.support'].includes(action)) return false;
  if (role === 'OWNER') return true;
  if (action.startsWith('organization.') || action.startsWith('knowledge.')) return false;
  if (role === 'ADMIN') {
    if (action.startsWith('map.') || action.startsWith('point.') || action.startsWith('mission.') || action.startsWith('floor.') || action.startsWith('location.')) {
      const m = db.memberships.find(m => m.userId === actor.userId && m.organizationId === organizationId && m.status === 'active');
      return !!m?.capabilities.includes(action.startsWith('mission.') ? 'missions' : 'maps');
    }
    return true;
  }
  return ['session.create','session.join','session.end','control.request','control.release','control.command','control.halt','control.stop','control.estop','chat.send','chat.retry','chat.read','ticket.create','notification.read'].includes(action);
}
export function scoped(db: Database, actor: Actor): Database {
  const result = structuredClone(db);
  if (roleFor(db, actor) === 'BOSS' && !actor.organizationId) return result;
  const user = db.users.find(u => u.id === actor.userId && u.status === 'active');
  const ids = new Set(user ? db.memberships.filter(m => m.userId === actor.userId && m.status === 'active' && (!actor.organizationId || actor.organizationId === m.organizationId) && db.organizations.some(o => o.id === m.organizationId && o.status === 'active')).map(m => m.organizationId) : []);
  if (user?.platformRole === 'BOSS' && actor.organizationId) ids.add(actor.organizationId);
  result.organizations = result.organizations.filter(o => ids.has(o.id));
  const orgArrays = ['memberships','robots','invitations','sessions','grants','messages','maps','points','missions','knowledge','locations','floors','assignments','calls','participants','conversations'] as const;
  for (const key of orgArrays) (result[key] as { organizationId: string }[]) = result[key].filter(v => ids.has(v.organizationId));
  result.audits = result.audits.filter(v => !!v.organizationId && ids.has(v.organizationId));
  result.incidents = result.incidents.filter(v => ids.has(v.organizationId));
  result.releases = result.releases.filter(v => !v.organizationId || ids.has(v.organizationId));
  result.tickets = result.tickets.filter(v => !!v.organizationId && ids.has(v.organizationId));
  result.notifications = result.notifications.filter(v => (!v.organizationId || ids.has(v.organizationId)) && (!v.userId || v.userId === actor.userId));
  const memberUserIds = new Set(result.memberships.map(m => m.userId));
  memberUserIds.add(actor.userId);
  result.users = result.users.filter(v => memberUserIds.has(v.id));
  for (const orgId of ids) if (roleFor(db, actor, orgId) === 'USER') {
    const robotIds = new Set(result.robots.filter(r => r.organizationId === orgId && r.status === 'active' && r.assignedUserIds.includes(actor.userId)).map(r => r.id));
    result.robots = result.robots.filter(r => r.organizationId !== orgId || robotIds.has(r.id));
    result.sessions = result.sessions.filter(s => s.organizationId !== orgId || ((s.userId === actor.userId || s.participantIds.includes(actor.userId)) && robotIds.has(s.robotId)));
    const sessionIds = new Set(result.sessions.map(s => s.id));
    result.grants = result.grants.filter(g => g.organizationId !== orgId || sessionIds.has(g.sessionId));
    result.messages = result.messages.filter(m => m.organizationId !== orgId || sessionIds.has(m.sessionId));
    result.missions = result.missions.filter(m => m.organizationId !== orgId || robotIds.has(m.robotId));
    result.invitations = result.invitations.filter(i => i.organizationId !== orgId || i.invitee.toLowerCase() === user?.email.toLowerCase());
    result.memberships = result.memberships.filter(m => m.organizationId !== orgId || m.userId === actor.userId);
    result.users = result.users.filter(u => u.id === actor.userId || result.memberships.some(m => m.userId === u.id && m.organizationId !== orgId));
    result.audits = result.audits.filter(a => a.organizationId !== orgId || a.actorId === actor.userId);
    result.tickets = result.tickets.filter(t => t.organizationId !== orgId || t.userId === actor.userId);
    result.incidents = result.incidents.filter(i => i.organizationId !== orgId || (!!i.robotId && robotIds.has(i.robotId)));
  }
  return result;
}
