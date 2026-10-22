import type {SVGProps} from 'react';

export type ActivityIconKind='overview'|'idle'|'telepresence'|'mission';
const ids:Record<ActivityIconKind,string>={overview:'FDR-ACTIVITY-OVERVIEW',idle:'FDR-ACTIVITY-IDLE',telepresence:'FDR-ACTIVITY-TELEPRESENCE',mission:'FDR-ACTIVITY-MISSION'};
/** The same static, text-free geometry as the four canonical Activity SVGs. */
export function ActivityIcon({kind,size=16,...props}:Omit<SVGProps<SVGSVGElement>,'children'>&{kind:ActivityIconKind;size?:number}){
 return <svg fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" width={size} height={size} className="feedar-asset" data-asset-id={ids[kind]} aria-hidden="true" focusable="false" {...props}>
  {kind==='overview'?<path d="M3 12h4l3-7 4 14 3-7h4"/>:kind==='idle'?<><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9v6M14.5 9v6"/></>:kind==='telepresence'?<><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/></>:<><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h5a3 3 0 0 0 0-6h-1a3 3 0 0 1 0-6h6"/></>}
 </svg>;
}
