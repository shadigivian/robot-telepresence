import type {CSSProperties,SVGProps} from 'react';
import {feedarAssets,feedarAssetGeometry,type FeedarAssetName,type FeedarTicketState} from './feedar-asset.generated';
import type {SupportTicket} from '../domain/models';
import '../styles/feedar-assets.css';

export type FeedarAssetProps=Omit<SVGProps<SVGSVGElement>,'name'|'children'|'dangerouslySetInnerHTML'>&{
 name:FeedarAssetName;size?:number;label?:string;batteryPercent?:number;ticketStatus?:SupportTicket['status'];
};
/** Presentation only. Callers retain all status, permission and battery policy. */
export function FeedarAsset({name,size=16,label,batteryPercent,ticketStatus='open',className='',style,width,height,...props}:FeedarAssetProps){
 const source=feedarAssets[name];
 const segments=batteryPercent===undefined||!Number.isFinite(batteryPercent)?undefined:Math.ceil(Math.max(0,Math.min(100,batteryPercent))/25);
 const ticketState:FeedarTicketState=ticketStatus==='new'?'open':ticketStatus;
 const [, ,vw,vh]=source.viewBox.split(' ').map(Number);
 return <svg {...source.props} {...props} viewBox={source.viewBox} width={width??size} height={height??(size*vh/vw)} className={`feedar-asset ${className}`.trim()} style={style as CSSProperties} data-asset-id={source.id} data-ticket-state={name==='ticketStatus'?ticketState:undefined} data-battery-known={name==='battery'?segments!==undefined:undefined} role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true} focusable="false">{feedarAssetGeometry(name,segments,ticketState)}</svg>;
}
