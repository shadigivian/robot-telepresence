import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { X, Bot, LoaderCircle } from 'lucide-react';
import { StatusIcon } from './status-icon';

export function Button({ variant = 'ghost', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost' }) { return <button type="button" className={`btn ${variant} ${className}`} {...props}/>; }
export function Card({children,className=''}:{children:ReactNode;className?:string}) { return <section className={`panel ${className}`}>{children}</section>; }
export function Badge({children,tone=''}:{children:ReactNode;tone?:string}) {return <span className={`badge ${tone}`}>{children}</span>;}
export function PageTitle({title,subtitle,actions,eyebrow}:{title:string;subtitle?:string;actions?:ReactNode;eyebrow?:string}) {return <header className="page-title"><div>{eyebrow&&<p className="kicker">{eyebrow}</p>}<h1>{title}</h1>{subtitle&&<p className="muted">{subtitle}</p>}</div>{actions&&<div className="row">{actions}</div>}</header>;}
export function Field({label,children}:{label:string;children:ReactNode}) {return <label className="field"><span>{label}</span>{children}</label>;}
export function Empty({children,title='Nothing here yet',text,action,state='empty'}:{children?:ReactNode;title?:string;text?:string;action?:ReactNode;state?:'empty'|'error'|'success'}) {return <div className="empty"><StatusIcon name={state==='empty'?'empty':state==='error'?'error':'approved'} size={34}/><h3>{title}</h3>{text&&<p className="muted">{text}</p>}{children}{action}</div>;}
export function LoadingVisual({text='Opening workspace…'}:{text?:string}) {return <main className="loading" role="status"><LoaderCircle className="loading-icon" size={28} aria-hidden="true"/><p>{text}</p></main>;}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);
 return <dialog ref={ref} className="modal" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><header className="row between"><h2>{title}</h2><Button aria-label="Close dialog" onClick={onClose}><X size={20}/></Button></header><div className="modal-body">{children}</div></dialog>;
}
export function FeedarMark({small=false}:{small?:boolean}) {return <span className={`brand ${small?'small':''}`}><span className="logo-tile"><Bot size={small?24:34}/></span><span>feedar<span className="brand-dot">.</span></span></span>;}
export function Stat({label,value,icon,detail}:{label:string;value:ReactNode;icon?:ReactNode;detail?:string}) {return <Card className="stat"><div className="row between"><span className="muted">{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong>{detail&&<span className="muted">{detail}</span>}</Card>;}
