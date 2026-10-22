import { Check, CircleAlert, Clock3, Radio, ShieldAlert, UserX, Wrench, X, type LucideIcon } from 'lucide-react';
import {FeedarAsset} from './feedar-asset';
import type {FeedarAssetName} from './feedar-asset.generated';
import type {ReactNode} from 'react';
import type {Session,SupportTicket} from '../domain/models';
import {ActivityIcon} from './activity-icon';
import {StatusTooltip} from './status-tooltip';

export type StatusIconName = 'online'|'offline'|'working'|'idle'|'activity'|'telepresence'|'mission'|'available'|'busy'|'unavailable'|'charging'|'battery'|'lowBattery'|'criticalBattery'|'currentUser'|'lastUser'|'maintenance'|'warning'|'error'|'visitorCall'|'sessionActive'|'sessionEnded'|'approved'|'rejected'|'pending'|'robot'|'empty';
const icons:Partial<Record<StatusIconName,LucideIcon>>={maintenance:Wrench,warning:ShieldAlert,error:CircleAlert,visitorCall:Radio,sessionEnded:UserX,approved:Check,rejected:X,pending:Clock3};
const assets:Partial<Record<StatusIconName,FeedarAssetName>>={online:'online',offline:'offline',available:'available',busy:'busy',unavailable:'unavailable',charging:'charging',battery:'battery',lowBattery:'battery',criticalBattery:'criticalBattery',currentUser:'currentUser',lastUser:'lastUser',robot:'robots',empty:'empty'};
const tones:Partial<Record<StatusIconName,string>>={online:'success',available:'success',approved:'success',offline:'muted',idle:'muted',sessionEnded:'muted',lowBattery:'warning',charging:'warning',warning:'warning',pending:'warning',busy:'warning',criticalBattery:'danger',error:'danger',rejected:'danger'};
export function activityIconName(activity:string):StatusIconName{return activity==='Idle'?'idle':activity==='Working · telepresence'?'telepresence':activity==='Working · mission'?'mission':'activity';}
const sessionIcons:Record<Session['status'],StatusIconName>={waiting:'pending',ringing:'pending',connecting:'pending',connected:'sessionActive',rejected:'rejected',busy:'busy',reconnecting:'pending',disconnected:'offline',expired:'sessionEnded',revoked:'sessionEnded',ended:'sessionEnded'};
export function sessionStatusIconName(status:Session['status']){return sessionIcons[status];}
export function StatusIcon({name,size=16,batteryPercent}:{name:StatusIconName;size?:number;batteryPercent?:number}){if(['activity','working','idle','telepresence','mission','sessionActive'].includes(name))return <ActivityIcon kind={name==='idle'?'idle':name==='telepresence'||name==='sessionActive'?'telepresence':name==='mission'?'mission':'overview'} size={size}/>;const asset=assets[name];if(asset)return <FeedarAsset name={asset} size={size} batteryPercent={batteryPercent}/>;const Icon=icons[name]!;return <Icon size={size} aria-hidden="true"/>;}
function readable(value:string){return value.charAt(0).toUpperCase()+value.slice(1);}
export function StatusIndicator({name,children,label,showText=false,passive=false,tone,live=false,batteryPercent}:{name:StatusIconName;children?:ReactNode;label?:string;showText?:boolean;passive?:boolean;tone?:string;live?:boolean;batteryPercent?:number}){
 const raw=typeof children==='string'||typeof children==='number'?String(children):name;
 const description=label??readable(raw);
 return <span className="status-indicator feedar-status" data-status={name} data-tone={tone??tones[name]??'default'} data-live={live}><StatusTooltip label={description} screenReaderText={showText?description:raw} passive={passive}><StatusIcon name={name} batteryPercent={batteryPercent}/></StatusTooltip>{showText&&<span className="status-value">{children}</span>}</span>;
}
const ticketLabels:Record<SupportTicket['status'],string>={new:'Open',open:'Open',in_review:'In Progress',awaiting_reply:'Waiting for User',resolved:'Resolved',closed:'Closed'};
export function ticketStatusLabel(status:SupportTicket['status']){return ticketLabels[status];}
export function TicketStatusIndicator({status,label=ticketLabels[status],tone='',passive=false}:{status:SupportTicket['status'];label?:string;tone?:string;passive?:boolean}){return <span className="status-indicator feedar-status" data-status="ticket" data-tone={tone}><StatusTooltip label={label} accessibleName="Explain ticket state" passive={passive}><FeedarAsset name="ticketStatus" ticketStatus={status}/></StatusTooltip></span>;}
