import {useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import '../styles/feedar-assets.css';
const tooltipListeners=new Set<(activeId:string)=>void>();

/** A real information control; passive mode belongs inside an existing link/button. */
export function StatusTooltip({label,accessibleName=label,screenReaderText=label,children,passive=false}:{label:string;accessibleName?:string;screenReaderText?:string;children:ReactNode;passive?:boolean}){
 const id=`feedar-tooltip-${useId()}`;
 const anchor=useRef<HTMLButtonElement&HTMLSpanElement>(null),tip=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false);
 const [parentSummary,setParentSummary]=useState<string|undefined>(undefined);
 const tooltipLabel=parentSummary??label;
 const pinned=useRef(false),focused=useRef(false),hovered=useRef(false),overTip=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const clearClose=()=>{if(timer.current!==undefined)clearTimeout(timer.current);timer.current=undefined;};
 const reveal=()=>{tooltipListeners.forEach(listener=>listener(id));setOpen(true);};
 const scheduleClose=()=>{clearClose();timer.current=setTimeout(()=>{if(!pinned.current&&!focused.current&&!hovered.current&&!overTip.current)setOpen(false);},120);};
 useEffect(()=>()=>{if(timer.current!==undefined)clearTimeout(timer.current);},[]);
 useEffect(()=>{if(!open){overTip.current=false;if(passive){const action=anchor.current?.parentElement?.closest('button,a[href],[role="button"]');if(action){const remaining=(action.getAttribute('aria-describedby')??'').split(/\s+/).filter(value=>value&&value!==id);if(remaining.length)action.setAttribute('aria-describedby',remaining.join(' '));else action.removeAttribute('aria-describedby');}}}},[open,passive,id]);
 useEffect(()=>{if(!open||!passive||parentSummary===undefined)return;const action=anchor.current?.parentElement?.closest('button,a[href],[role="button"]');if(!action)return;const observer=new window.MutationObserver(()=>setParentSummary([...new Set([...action.querySelectorAll('.status-tooltip-trigger.passive')].map(element=>element.getAttribute('aria-label')).filter(Boolean))].join(' · ')));observer.observe(action,{attributes:true,childList:true,subtree:true,attributeFilter:['aria-label']});return()=>observer.disconnect();},[open,passive,parentSummary]);
 useEffect(()=>{const closeOther=(activeId:string)=>{if(activeId!==id){pinned.current=false;setOpen(false);}};tooltipListeners.add(closeOther);return()=>{tooltipListeners.delete(closeOther);};},[id]);
 useEffect(()=>{
  if(!passive)return;
  const action=anchor.current?.parentElement?.closest('button,a[href],[role="button"]');
  if(!action)return;
  const removeDescription=()=>{const remaining=(action.getAttribute('aria-describedby')??'').split(/\s+/).filter(value=>value&&value!==id);if(remaining.length)action.setAttribute('aria-describedby',remaining.join(' '));else action.removeAttribute('aria-describedby');};
  const show=()=>{
   // One existing action may contain several decorative statuses. Its focus
   // receives one combined tooltip rather than several overlapping popovers.
   if(action.querySelector('.status-tooltip-trigger.passive')!==anchor.current)return;
   focused.current=true;
   setParentSummary([...new Set([...action.querySelectorAll('.status-tooltip-trigger.passive')].map(element=>element.getAttribute('aria-label')).filter(Boolean))].join(' · '));
   action.setAttribute('aria-describedby',[...(action.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean),id].join(' '));
   reveal();
  },hide=()=>{focused.current=false;pinned.current=false;setOpen(false);removeDescription();};
  action.addEventListener('focus',show);action.addEventListener('blur',hide);action.addEventListener('click',hide);
  return()=>{action.removeEventListener('focus',show);action.removeEventListener('blur',hide);action.removeEventListener('click',hide);removeDescription();};
 },[passive,id]);
 useLayoutEffect(()=>{
  const element=tip.current,target=anchor.current;
  if(!open||!element||!target)return;
  // Native popovers stay above both scroll containers and native dialog top layers.
  if(typeof element.showPopover==='function')element.showPopover();
  const position=()=>{
   const box=target.getBoundingClientRect(),viewport=window.visualViewport;
   const left=viewport?.offsetLeft??0,top=viewport?.offsetTop??0,width=viewport?.width??document.documentElement.clientWidth,height=viewport?.height??window.innerHeight;
   element.style.maxWidth=`min(18rem, ${Math.max(0,width-16)}px)`;element.style.maxHeight=`${Math.max(0,height-16)}px`;
   const bubble=element.getBoundingClientRect();
   if(box.bottom<top||box.top>top+height||box.right<left||box.left>left+width){pinned.current=false;setOpen(false);return;}
   const x=Math.max(left+8,Math.min(box.left+(box.width-bubble.width)/2,left+width-bubble.width-8));
   const below=box.bottom+8,above=box.top-bubble.height-8;
   const y=below+bubble.height<=top+height-8?below:Math.max(top+8,above);
   element.style.left=`${x}px`;element.style.top=`${y}px`;element.style.visibility='visible';
  };
  position();
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!target.contains(event.target)&&!element.contains(event.target)){pinned.current=false;setOpen(false);}};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();pinned.current=false;setOpen(false);}};
  window.addEventListener('pointerdown',outside,true);window.addEventListener('keydown',escape,true);window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
  const observer=new window.ResizeObserver(position);observer.observe(target);observer.observe(element);
  return()=>{observer.disconnect();window.removeEventListener('pointerdown',outside,true);window.removeEventListener('keydown',escape,true);window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);window.visualViewport?.removeEventListener('scroll',position);if(element.isConnected&&typeof element.hidePopover==='function'&&element.matches(':popover-open'))element.hidePopover();};
 },[open,tooltipLabel]);
 const shared={className:`status-tooltip-trigger${passive?' passive':''}`, 'aria-label':accessibleName,'aria-describedby':open?id:accessibleName!==label?`${id}-label`:undefined,onMouseEnter:()=>{clearClose();setParentSummary(undefined);hovered.current=true;reveal();},onMouseLeave:()=>{hovered.current=false;scheduleClose();}};
 const contents=<>{children}<span id={`${id}-label`} className="status-tooltip-label">{screenReaderText}</span></>;
 const host=open&&typeof document!=='undefined'?(anchor.current?.closest('dialog[open]')??document.body):null;
 return <>{passive?<span {...shared} role="img" ref={anchor}>{contents}</span>:<button {...shared} type="button" ref={anchor} onFocus={()=>{clearClose();focused.current=true;reveal();}} onBlur={()=>{focused.current=false;pinned.current=false;scheduleClose();}} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();clearClose();pinned.current=!pinned.current;if(pinned.current)reveal();else setOpen(false);}} onKeyDown={event=>{if(event.key===' '||event.key==='Enter')event.stopPropagation();}}>{contents}</button>}{host&&createPortal(<div id={id} ref={tip} className="feedar-tooltip" role="tooltip" popover="manual" style={{visibility:'hidden'}} onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onMouseEnter={()=>{clearClose();overTip.current=true;}} onMouseLeave={()=>{overTip.current=false;scheduleClose();}}>{tooltipLabel}</div>,host)}</>;
}
