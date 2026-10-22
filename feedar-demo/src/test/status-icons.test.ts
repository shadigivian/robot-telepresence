import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {StatusIcon,StatusIndicator,TicketStatusIndicator,activityIconName} from '../components/status-icon';
import {seedDatabase} from '../data/seed';
import {robotControlStatus} from '../domain/robot-status';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {feedarAssets} from '../components/feedar-asset.generated';
import originalSources from '../../docs/ASSET_V1_SOURCES.json';

function geometry(svg:string){
 return [...svg.matchAll(/<(path|circle|rect|ellipse|line|polyline|polygon)\b([^>]*?)\/?\s*>/g)].map(([,tag,attributes])=>({tag,attributes:[...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]).sort(([a],[b])=>a.localeCompare(b))}));
}

describe('shared icon-only statuses',()=>{
 it('keeps an accessible status label without a visible duplicate',()=>{
  const html=renderToStaticMarkup(createElement(StatusIndicator,{name:'offline',label:'Offline'},'offline'));
  expect(html).toContain('FDR-ROBOT-OFFLINE');
  expect(html).toContain('aria-label="Offline"');
  expect(html).toMatch(/class="[^"]*status-tooltip-label[^"]*"[^>]*>offline<\/span>/);
  expect(html).not.toContain('status-value');
  expect(html).toContain('aria-hidden="true"');
 });
 it('preserves real identities and battery values when explicitly requested',()=>{
  const current=renderToStaticMarkup(createElement(StatusIndicator,{name:'currentUser',label:'Current connected user',showText:true},'Daniel Foster · @daniel.foster'));
  const battery=renderToStaticMarkup(createElement(StatusIndicator,{name:'battery',label:'Battery',batteryPercent:87,showText:true},'87%'));
  expect(current).toMatch(/class="status-value"[^>]*>Daniel Foster · @daniel.foster<\/span>/);
  expect(battery).toMatch(/class="status-value"[^>]*>87%<\/span>/);
  expect(battery).toContain('data-battery-known="true"');
 });
 it('uses the current-user identity glyph for absence and a separate history glyph for Last',()=>{
  const current=renderToStaticMarkup(createElement(StatusIndicator,{name:'currentUser',label:'No active user'},'No active user'));
  const last=renderToStaticMarkup(createElement(StatusIndicator,{name:'lastUser',label:'No previous user'},'No previous user'));
  expect(current).toContain('FDR-CURRENT-CONNECTED-USER');
  expect(last).toContain('FDR-LAST-CONNECTED-USER');
  expect(current).not.toMatch(/lucide-clock|FDR-ACTIVITY-IDLE/);
  expect(current).not.toContain('status-value');
  expect(last).not.toContain('status-value');
 });
 it('keeps ticket states and the new/Open alias behind the correct glyph',()=>{
  for(const status of ['open','new','in_review','awaiting_reply','resolved','closed']as const){
   const label=status==='in_review'?'In Progress':status==='awaiting_reply'?'Waiting for User':status==='new'?'Open':status;
   const html=renderToStaticMarkup(createElement(TicketStatusIndicator,{status,label}));
   expect(html).toContain('FDR-TICKET-STATUS-BADGE');
   expect(html).toContain(`data-ticket-state="${status==='new'?'open':status}"`);
   expect(html).toContain('aria-label="Explain ticket state"');
   expect(html).toContain(`>${label}</span>`);
   expect(html).not.toContain('status-value');
  }
 });
 it('maps actual selector results to three distinct, text-free Activity glyphs',()=>{
  const now=Date.now(),db=seedDatabase(now),robot=db.robots.find(r=>r.id==='robot-7')!;
  const activities=[robotControlStatus(db,robot,now).activity];
  db.missions.push({id:'status-unit-mission',createdAt:now,updatedAt:now,revision:1,organizationId:robot.organizationId,robotId:robot.id,pointId:db.points[0].id,status:'running',eta:120,actorId:'owner'});
  activities.push(robotControlStatus(db,robot,now).activity);
  db.sessions.push({id:'status-unit-session',createdAt:now,updatedAt:now,revision:1,organizationId:robot.organizationId,robotId:robot.id,userId:'user',status:'connected',capabilities:['video','chat'],expiresAt:now+1800000,participantIds:['user']});
  activities.push(robotControlStatus(db,robot,now).activity);
  expect(activities).toEqual(['Idle','Working · mission','Working · telepresence']);
  const expected=['FDR-ACTIVITY-IDLE','FDR-ACTIVITY-MISSION','FDR-ACTIVITY-TELEPRESENCE'];
  const markup=activities.map((activity,index)=>{
   const html=renderToStaticMarkup(createElement(StatusIcon,{name:activityIconName(activity)}));
   expect(html).toContain(expected[index]);
   expect(html).toContain('viewBox="0 0 24 24"');
   expect(html).not.toMatch(/<text\b|<foreignObject\b|<image\b|<animate\b|<title\b/);
   return html;
  });
  expect(new Set(markup).size).toBe(3);
 });
 it('does not put a nested action inside existing clickable fleet rows',()=>{
  const html=renderToStaticMarkup(createElement(StatusIndicator,{name:'online',label:'Online',passive:true},'online'));
  expect(html).toContain('FDR-ROBOT-ONLINE');
  expect(html).not.toContain('<button');
  expect(html).toContain('Online');
 });
 it('matches the four canonical Activity SVG geometries and leaves the reviewed sixteen untouched',()=>{
  for(const[name,file]of [['activity','overview'],['idle','idle'],['telepresence','telepresence'],['mission','mission']]as const){
   const source=readFileSync(new URL(`../assets/icons/activity/activity-${file}.svg`,import.meta.url),'utf8');
   const rendered=renderToStaticMarkup(createElement(StatusIcon,{name}));
   expect(geometry(rendered)).toEqual(geometry(source));
   expect(geometry(source).length).toBeGreaterThan(0);
   expect(source).toContain('stroke="currentColor"');
   expect(source).toContain('stroke-width="1.85"');
   expect(source).not.toMatch(/<(?:text|foreignObject|image|script|animate|title)\b/);
  }
  expect(originalSources).toHaveLength(16);
  expect(Object.keys(feedarAssets)).toHaveLength(16);
  for(const source of originalSources){
   const bytes=readFileSync(new URL(`../../${source.canonical_proposed_path}`,import.meta.url));
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
  }
 });
});
