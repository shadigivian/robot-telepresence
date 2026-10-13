import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Bell, Bot, Building2, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Map, Menu, MessageSquare, Settings, ShieldCheck, Users, Video, BookOpen, Mail, ArrowUpRight, Circle } from 'lucide-react';
import { useDemo } from './context';
import { Button, FeedarMark, Modal, Field, Empty } from '../components/ui';
import type { Role } from '../domain/models';
import { localMedia } from '../services/demo/media';

const WelcomePage=lazy(()=>import('../features/auth').then(m=>({default:m.WelcomePage})));
const LoginPage=lazy(()=>import('../features/auth').then(m=>({default:m.LoginPage})));
const OverviewPage=lazy(()=>import('../features/management').then(m=>({default:m.OverviewPage})));
const OrganizationsPage=lazy(()=>import('../features/management').then(m=>({default:m.OrganizationsPage})));
const OrganizationPage=lazy(()=>import('../features/management').then(m=>({default:m.OrganizationPage})));
const MembersPage=lazy(()=>import('../features/management').then(m=>({default:m.MembersPage})));
const InvitationsPage=lazy(()=>import('../features/management').then(m=>({default:m.InvitationsPage})));
const SettingsPage=lazy(()=>import('../features/management').then(m=>({default:m.SettingsPage})));
const ActivityPage=lazy(()=>import('../features/management').then(m=>({default:m.ActivityPage})));
const PublicOrganizationPage=lazy(()=>import('../features/links').then(m=>({default:m.PublicOrganizationPage})));
const InvitationPage=lazy(()=>import('../features/links').then(m=>({default:m.InvitationPage})));
const SessionInvitationPage=lazy(()=>import('../features/links').then(m=>({default:m.SessionInvitationPage})));
const FleetPage=lazy(()=>import('../features/fleet').then(m=>({default:m.FleetPage})));
const MapsPage=lazy(()=>import('../features/maps').then(m=>({default:m.MapsPage})));
const KioskPage=lazy(()=>import('../features/kiosk').then(m=>({default:m.KioskPage})));
const KnowledgePage=lazy(()=>import('../features/knowledge').then(m=>({default:m.KnowledgePage})));
const SessionPage=lazy(()=>import('../features/session').then(m=>({default:m.SessionPage})));

function StandaloneNotice(){const {pathname}=useLocation();if(['/welcome','/login','/'].includes(pathname)||pathname.startsWith('/o/')||pathname.startsWith('/join/')||pathname.startsWith('/session/'))return <div className="demo-banner standalone-demo-banner"><ShieldCheck size={15}/><strong>DEMO MODE</strong><span>— Simulated robot; no physical hardware connected.</span></div>;return null;}
function NavigationSafety(){
 const location=useLocation();
 const stop=()=>{localMedia.stop();window.dispatchEvent(new Event('feedar-navigation'));};
 useLayoutEffect(stop,[location.key]);
 useEffect(()=>{
  const click=(event:MouseEvent)=>{const anchor=(event.target as HTMLElement|null)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!anchor)return;const url=new URL(anchor.href,window.location.href);if(url.origin===window.location.origin&&url.hash)stop();};
  document.addEventListener('click',click,true);window.addEventListener('popstate',stop);window.addEventListener('hashchange',stop);window.addEventListener('pagehide',stop);
  return()=>{document.removeEventListener('click',click,true);window.removeEventListener('popstate',stop);window.removeEventListener('hashchange',stop);window.removeEventListener('pagehide',stop);};
 },[]);
 return null;
}

const destinations=[
 {path:'/overview',label:'Overview',icon:LayoutDashboard,roles:['BOSS','OWNER','ADMIN','USER']},
 {path:'/organizations',label:'Organizations',icon:Building2,roles:['BOSS']},
 {path:'/operations',label:'Robot Operations',icon:Bot,roles:['BOSS','OWNER','ADMIN']},
 {path:'/remote',label:'Remote Session',icon:Video,roles:['BOSS','OWNER','ADMIN','USER']},
 {path:'/display',label:'Robot Display',icon:MessageSquare,roles:['BOSS','OWNER','ADMIN','USER']},
 {path:'/members',label:'Members',icon:Users,roles:['BOSS','OWNER','ADMIN']},
 {path:'/maps',label:'Maps & locations',icon:Map,roles:['BOSS','OWNER','ADMIN']},
 {path:'/invitations',label:'Invitations',icon:Mail,roles:['BOSS','OWNER','ADMIN']},
 {path:'/knowledge',label:'Knowledge',icon:BookOpen,roles:['BOSS','OWNER']},
 {path:'/activity',label:'Activity & maintenance',icon:Activity,roles:['BOSS','OWNER','ADMIN']},
 {path:'/settings',label:'Settings',icon:Settings,roles:['BOSS','OWNER','ADMIN']},
];
function Guard({roles}:{roles?:Role[]}){const {actor,role}=useDemo();if(!actor)return <Navigate to="/login" replace/>;if(roles&&!roles.includes(role))return <Empty title="Access unavailable" text="This demo identity does not have permission to open this workspace." action={<Link className="btn primary" to="/overview">Return to overview</Link>}/>;return <Outlet/>;}
function Switcher(){const {switchPersona}=useDemo();const navigate=useNavigate();const location=useLocation();const [fullscreen,setFullscreen]=useState(!!document.fullscreenElement);useEffect(()=>{const update=()=>setFullscreen(!!document.fullscreenElement);document.addEventListener('fullscreenchange',update);return()=>document.removeEventListener('fullscreenchange',update);},[]);if(fullscreen&&location.pathname.includes('/kiosk'))return null;
 const screens=[['Welcome','/welcome'],['Login','/login'],['Boss','/overview','boss'],['Org','/organizations/org-hospital','owner'],['Admin','/operations','admin'],['User','/remote','user'],['Robot','/display','owner']];
 return <aside className="demo-switcher" aria-label="Demo preview"><span>Demo preview</span>{screens.map(([label,path,user])=><button key={label} onClick={()=>{if(user)switchPersona(user,user==='boss'?undefined:'org-hospital');navigate(path);}}>{label}</button>)}</aside>;
}
function Shell(){const {db,actor,role,organization,logout,act,notify,selectOrganization}=useDemo();const location=useLocation();const navigate=useNavigate();const [menu,setMenu]=useState(false);const [dialog,setDialog]=useState<'support'|'notifications'|'profile'|null>(null);const [subject,setSubject]=useState('');const [text,setText]=useState('');
 const user=db.users.find(u=>u.id===actor?.userId);const current=destinations.find(d=>location.pathname.startsWith(d.path));const unread=db.notifications.filter(n=>!n.readBy.includes(actor?.userId??''));
 useEffect(()=>{setMenu(false);},[location.pathname]);
 return <div className="app-shell"><aside className={`sidebar ${menu?'open':''}`}><Link to="/overview" className="brand-link"><FeedarMark small/></Link><div className="workspace-label">ROBOT CLOUD <span>Workspace</span></div><nav aria-label="Workspace navigation">{destinations.filter(d=>d.roles.includes(role)).map((d,i)=><NavLink key={d.path} to={d.path} className={({isActive})=>`${isActive?'active':''} ${i===5?'nav-divider':''}`}><d.icon size={19}/>{d.label}</NavLink>)}</nav><div className="sidebar-footer"><div className="health"><span className="dot"/> Demo services available</div><Button onClick={()=>setDialog('support')}><CircleHelp size={18}/> Support <ArrowUpRight size={15}/></Button><button className="profile" onClick={()=>setDialog('profile')}><span className="avatar">{user?.name?.slice(0,1)??'F'}</span><span><strong>{user?.name??'Demo identity'}</strong><small>{role==='BOSS'?'Platform owner':role==='OWNER'?'Organization owner':role.toLowerCase()}</small></span><ChevronDown size={16}/></button></div></aside>{menu&&<button className="sidebar-overlay" aria-label="Close navigation" onClick={()=>setMenu(false)}/>}
 <div className="workspace"><header className="topbar"><div className="row"><Button className="mobile-menu" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu/></Button><span className="breadcrumb">Feedar Cloud <span>/</span> <strong>{current?.label??organization?.name??'Organization workspace'}</strong></span></div><div className="row"><span className="environment"><Circle size={8} fill="currentColor"/> Browser demo</span><button className="icon-button" aria-label="Notifications" onClick={()=>setDialog('notifications')}><Bell size={19}/>{unread.length>0&&<i/>}</button><button className="avatar small-avatar" aria-label="Open profile" onClick={()=>setDialog('profile')}>{user?.name?.slice(0,1)??'F'}</button></div></header><div className="demo-banner"><ShieldCheck size={15}/><strong>DEMO MODE</strong><span>— Simulated robot; no physical hardware connected.</span></div>{role==='BOSS'&&organization&&<div className="support-banner">Support context · {organization.name} · Platform access is recorded in local demo activity. <Button onClick={()=>{selectOrganization(undefined);navigate('/organizations');}}>Exit context</Button></div>}<main className="content"><Outlet/></main><footer className="workspace-footer"><span>feedar cloud · Connected to people.</span><span>Browser-local data · Simulated integrations</span></footer></div>
 {dialog==='support'&&<Modal title="Contact support" onClose={()=>setDialog(null)}><p className="muted">Create a local demo ticket. No email is sent.</p><form className="stack" onSubmit={async e=>{e.preventDefault();await act('ticket.create',{organizationId:organization?.id,subject,text});notify('Local demo support ticket created.');setDialog(null);setText('');setSubject('');}}><Field label="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} required maxLength={120}/></Field><Field label="Message · fictional demo content only"><textarea value={text} onChange={e=>setText(e.target.value)} required maxLength={2000}/></Field><Button type="submit" variant="primary">Create ticket</Button></form></Modal>}
 {dialog==='notifications'&&<Modal title="Notifications" onClose={()=>setDialog(null)}><p className="muted">Same-browser synchronization. Remote delivery is not configured.</p><div className="stack">{db.notifications.length===0?<Empty title="You’re all caught up"/>:db.notifications.map(n=><button className="notification" key={n.id} onClick={()=>{void act('notification.read',{id:n.id});setDialog(null);navigate(n.href);}}><Bell size={18}/><span><strong>{n.title}</strong><p>{n.text}</p></span>{!n.readBy.includes(actor?.userId??'')&&<span className="dot"/>}</button>)}</div></Modal>}
 {dialog==='profile'&&<Modal title="Demo profile" onClose={()=>setDialog(null)}><div className="stack"><p>{user?.name} · {user?.email}</p><p className="muted">Identity is scoped to this tab. Roles shown here demonstrate frontend policy; production authentication requires a backend.</p>{(role==='BOSS'||db.organizations.length>1)&&<Field label="Workspace"><select value={organization?.id??''} onChange={e=>selectOrganization(e.target.value||undefined)}>{role==='BOSS'&&<option value="">Platform command center</option>}{db.organizations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></Field>}<Button variant="danger" onClick={()=>{logout();setDialog(null);navigate('/login');}}><LogOut size={18}/> Sign out</Button></div></Modal>}
 </div>;
}
function NotFound(){return <main className="standalone"><Empty title="This demo page is unavailable" text="The link is unknown or its browser-local demo record no longer exists." action={<Link className="btn primary" to="/welcome">Open Feedar</Link>}/></main>;}
export function App(){return <><NavigationSafety/><StandaloneNotice/><Suspense fallback={<main className="loading"><p>Opening demo workspace…</p></main>}><Routes><Route path="/" element={<Navigate to="/welcome" replace/>}/><Route path="/welcome" element={<WelcomePage/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/o/:slug" element={<PublicOrganizationPage/>}/><Route path="/join/:token" element={<InvitationPage/>}/><Route path="/session/:token" element={<SessionInvitationPage/>}/><Route path="/robot/:robotId/kiosk" element={<KioskPage/>}/><Route element={<Guard/>}><Route element={<Shell/>}><Route path="/overview" element={<OverviewPage/>}/><Route element={<Guard roles={['BOSS']}/>}><Route path="/organizations" element={<OrganizationsPage/>}/></Route><Route element={<Guard roles={['BOSS','OWNER','ADMIN']}/>}><Route path="/organizations/:id" element={<OrganizationPage/>}/><Route path="/organization/:id" element={<OrganizationPage/>}/><Route path="/operations" element={<FleetPage/>}/><Route path="/robots" element={<FleetPage/>}/><Route path="/robots/:robotId" element={<FleetPage/>}/><Route path="/maintenance" element={<FleetPage/>}/><Route path="/members" element={<MembersPage/>}/><Route path="/invitations" element={<InvitationsPage/>}/><Route path="/maps" element={<MapsPage/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="/activity" element={<ActivityPage/>}/></Route><Route element={<Guard roles={['BOSS','OWNER']}/>}><Route path="/knowledge" element={<KnowledgePage/>}/></Route><Route path="/remote" element={<SessionPage/>}/><Route path="/display" element={<KioskPage/>}/></Route></Route><Route path="*" element={<NotFound/>}/></Routes></Suspense><Switcher/></>;}
