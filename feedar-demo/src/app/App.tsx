import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Map, Menu, MessageSquare, Settings, ShieldCheck, Users, Video, BookOpen, Mail, ArrowUpRight, Circle } from 'lucide-react';
import { useDemo } from './context';
import { Button, FeedarMark, Modal, Field, Empty, LoadingVisual } from '../components/ui';
import { ThemeToggle } from './theme';
import { FeedarAsset } from '../components/feedar-asset';
import { StatusIcon } from '../components/status-icon';
import type { Role } from '../domain/models';
import { localMedia } from '../services/demo/media';
import {demoAvailable,stagingDemo,stagingRoleAllowed,surface} from './runtime';

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
const BossRobotManagementPage=lazy(()=>import('../features/boss').then(m=>({default:m.BossRobotManagementPage})));
const BossSupportPage=lazy(()=>import('../features/boss-support').then(m=>({default:m.BossSupportPage})));
const BossRobotMonitoringPage=lazy(()=>import('../features/boss').then(m=>({default:m.BossRobotMonitoringPage})));
const OrganizationInformationPage=lazy(()=>import('../features/org-information').then(m=>({default:m.OrganizationInformationPage})));
const UsersPermissionsPage=lazy(()=>import('../features/org-people').then(m=>({default:m.UsersPermissionsPage})));
const OrganizationRobotManagementPage=lazy(()=>import('../features/org-robots').then(m=>({default:m.OrganizationRobotManagementPage})));
const OrganizationRobotStatusPage=lazy(()=>import('../features/org-robots').then(m=>({default:m.OrganizationRobotStatusPage})));
const BillingSupportPage=lazy(()=>import('../features/org-support').then(m=>({default:m.BillingSupportPage})));
const MapsPage=lazy(()=>import('../features/maps').then(m=>({default:m.MapsPage})));
const KioskPage=lazy(()=>import('../features/kiosk').then(m=>({default:m.KioskPage})));
const KnowledgePage=lazy(()=>import('../features/knowledge').then(m=>({default:m.KnowledgePage})));
const SessionPage=lazy(()=>import('../features/session').then(m=>({default:m.SessionPage})));

function StandaloneNotice(){const {pathname}=useLocation();if(['/welcome','/login','/'].includes(pathname)||pathname.startsWith('/o/')||pathname.startsWith('/join/')||pathname.startsWith('/session/'))return <div className="demo-banner standalone-demo-banner">{!(['/welcome','/login','/'].includes(pathname))&&<ThemeToggle/>}<ShieldCheck size={15}/><strong>DEMO MODE</strong><span>— Simulated robot; no physical hardware connected.</span></div>;return null;}
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

function RobotNavigationIcon({size=19}:{size?:number}){return <FeedarAsset name="robots" size={size}/>;}
function ActivityNavigationIcon({size=19}:{size?:number}){return <StatusIcon name="activity" size={size}/>;}

const destinations=[
 {path:'/overview',label:'Overview',icon:LayoutDashboard,roles:['BOSS','OWNER','ADMIN','USER']},
 {path:'/organizations',label:'Organizations',icon:Building2,roles:['BOSS']},
 {path:'/robot-management',label:'Robot Management',icon:RobotNavigationIcon,roles:['BOSS']},
 {path:'/robot-monitoring',label:'Robot Monitoring',icon:RobotNavigationIcon,roles:['BOSS']},
 {path:'/boss/support',label:'Support / Tickets',icon:CircleHelp,roles:['BOSS']},
 {path:'/operations',label:'Robot Operations',icon:RobotNavigationIcon,roles:['BOSS','OWNER','ADMIN']},
 {path:'/remote',label:'Remote Session',icon:Video,roles:['BOSS','OWNER','ADMIN','USER']},
 {path:'/org/status',label:'Robot Status',icon:RobotNavigationIcon,roles:['USER']},
 {path:'/display',label:'Robot Display',icon:MessageSquare,roles:['BOSS','OWNER','ADMIN','USER']},
 {path:'/members',label:'Members',icon:Users,roles:['BOSS','OWNER','ADMIN']},
 {path:'/maps',label:'Maps & locations',icon:Map,roles:['BOSS','OWNER','ADMIN']},
 {path:'/invitations',label:'Invitations',icon:Mail,roles:['BOSS','OWNER','ADMIN']},
 {path:'/knowledge',label:'Knowledge',icon:BookOpen,roles:['BOSS','OWNER']},
 {path:'/activity',label:'Activity & maintenance',icon:ActivityNavigationIcon,roles:['BOSS','OWNER','ADMIN']},
 {path:'/settings',label:'Settings',icon:Settings,roles:['BOSS','OWNER','ADMIN']},
];
const organizationDestinations=[
 {path:'/org/info',label:'Organization Information',icon:Building2},
 {path:'/org/users',label:'Users & Permissions',icon:Users},
 {path:'/org/robots',label:'Robot Management',icon:RobotNavigationIcon},
 {path:'/org/status',label:'Robot Status',icon:RobotNavigationIcon},
 {path:'/org/telepresence',label:'Telepresence',icon:Video},
 {path:'/org/billing-support',label:'Billing & Support',icon:CircleHelp},
];
function Guard({roles}:{roles?:Role[]}){const {actor,role}=useDemo();if(!actor)return <Navigate to="/login" replace/>;if(stagingDemo&&!stagingRoleAllowed(surface,role))return <Navigate to="/login" replace/>;if(roles&&!roles.includes(role))return <Empty state="error" title="Access unavailable" text="This demo identity does not have permission to open this workspace." action={<Link className="btn primary" to="/overview">Return to overview</Link>}/>;return <Outlet/>;}
function WorkspaceOnly(){const {role,organization}=useDemo();if(role==='BOSS'&&!organization)return <Empty state="unavailable" title="Organization workspace required" text="Enter an organization from Organizations to use its management workspace." action={<Link className="btn primary" to="/organizations">Open organizations</Link>}/>;return <Outlet/>;}
function Shell(){const {db,actor,role,organization,logout,act,notify,selectOrganization}=useDemo();const location=useLocation();const navigate=useNavigate();const [menu,setMenu]=useState(false);const [dialog,setDialog]=useState<'support'|'notifications'|'profile'|null>(null);const [subject,setSubject]=useState('');const [text,setText]=useState('');const [supportOrg,setSupportOrg]=useState('');
 const user=db.users.find(u=>u.id===actor?.userId);const current=[...organizationDestinations,...destinations].find(d=>location.pathname.startsWith(d.path));const unread=db.notifications.filter(n=>!n.readBy.includes(actor?.userId??''));const platformBoss=role==='BOSS'&&!organization;const visitorRequests=db.visitorRequests.filter(r=>r.targetUserId===actor?.userId);const organizationPanel=!!organization&&['BOSS','OWNER','ADMIN'].includes(role);const bossSections=new Set(['/overview','/organizations','/robot-management','/robot-monitoring','/boss/support','/settings']);const visibleDestinations=organizationPanel?organizationDestinations:destinations.filter(d=>d.roles.includes(role)&&(!platformBoss||bossSections.has(d.path)));
 useEffect(()=>{setMenu(false);},[location.pathname]);
 return <div className="app-shell"><aside className={`sidebar ${menu?'open':''}`}><Link to={organizationPanel?'/org/info':'/overview'} className="brand-link"><FeedarMark small/></Link><div className="workspace-label">ROBOT CLOUD <span>Workspace</span></div><nav aria-label="Workspace navigation">{visibleDestinations.map(d=><NavLink key={d.path} to={d.path} className={({isActive})=>`${isActive?'active':''} ${!platformBoss&&!organizationPanel&&d.path==='/members'?'nav-divider':''}`}><d.icon size={19}/>{d.label}</NavLink>)}</nav><div className="sidebar-footer"><div className="health"><span className="dot"/> Demo services available</div><Button onClick={()=>role==='USER'?navigate('/org/billing-support'):setDialog('support')}><CircleHelp size={18}/> Support <ArrowUpRight size={15}/></Button><button className="profile" onClick={()=>setDialog('profile')}><span className="avatar">{user?.name?.slice(0,1)??'F'}</span><span><strong>{user?.name??'Demo identity'}</strong><small>{role==='BOSS'?'Platform owner':role==='OWNER'?'Organization owner':role.toLowerCase()}</small></span><ChevronDown size={16}/></button></div></aside>{menu&&<button className="sidebar-overlay" aria-label="Close navigation" onClick={()=>setMenu(false)}/>}
 <div className="workspace"><header className="topbar"><div className="row"><Button className="mobile-menu" aria-label="Open navigation" onClick={()=>setMenu(true)}><Menu/></Button><span className="breadcrumb">Feedar Cloud <span>/</span> <strong>{current?.label??organization?.name??'Organization workspace'}</strong></span></div><div className="row"><span className="environment"><Circle size={8} fill="currentColor"/> Browser demo</span><ThemeToggle/><button className="icon-button" aria-label="Notifications" onClick={()=>setDialog('notifications')}><FeedarAsset name="notification" size={19}/>{unread.length>0&&<span className="notification-count" aria-label={`${unread.length} unread notifications`}>{unread.length>99?'99+':unread.length}</span>}</button><button className="avatar small-avatar" aria-label="Open profile" onClick={()=>setDialog('profile')}>{user?.name?.slice(0,1)??'F'}</button></div></header><div className="demo-banner"><ShieldCheck size={15}/><strong>DEMO MODE</strong><span>— Simulated robot; no physical hardware connected.</span></div>{role==='BOSS'&&organization&&<div className="support-banner">Boss managing {organization.name} · Changes are recorded under your Boss identity. <Button onClick={()=>{selectOrganization(undefined);navigate('/overview');}}>Back to Boss</Button></div>}<main className="content"><Outlet/></main><footer className="workspace-footer"><span>feedar cloud · Connected to people.</span><span>Browser-local data · Simulated integrations</span></footer></div>
 {dialog==='support'&&<Modal title="Contact support" onClose={()=>setDialog(null)}><p className="muted">Create a local demo ticket. No email is sent.</p><form className="stack" onSubmit={async e=>{e.preventDefault();const created=await act('ticket.create',{organizationId:organization?.id??supportOrg,subject,text});if(created){notify('Local demo support ticket created.');setDialog(null);setText('');setSubject('');}}}>{platformBoss&&<Field label="Organization"><select required value={supportOrg} onChange={e=>setSupportOrg(e.target.value)}><option value="">Choose organization</option>{db.organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>}<Field label="Subject"><input value={subject} onChange={e=>setSubject(e.target.value)} required maxLength={120}/></Field><Field label="Message · fictional demo content only"><textarea value={text} onChange={e=>setText(e.target.value)} required maxLength={2000}/></Field><Button type="submit" variant="primary">Create ticket</Button></form></Modal>}
 {dialog==='notifications'&&<Modal title="Notifications" onClose={()=>setDialog(null)}><p className="muted">Same-browser synchronization. Remote delivery is not configured.</p><div className="stack">{db.notifications.length===0&&!visitorRequests.length?<Empty title="You’re all caught up"/>:db.notifications.map(n=><button className="notification" key={n.id} onClick={()=>{void act('notification.read',{id:n.id});setDialog(null);navigate(n.href);}}><FeedarAsset name="notification" size={18}/><span><strong>{n.title}</strong><p>{n.text}</p></span>{!n.readBy.includes(actor?.userId??'')&&<span className="dot"/>}</button>)}{visitorRequests.map(r=><div className="notification" key={r.id}><FeedarAsset name="notification" size={18}/><span><strong>{db.robots.find(x=>x.id===r.robotId)?.name??r.robotId} · {r.visitorName??'Visitor'}</strong><p>{new Date(r.createdAt).toLocaleString()} · {r.expiresAt<=Date.now()&&r.status==='pending'?'expired':r.status}</p></span>{r.status==='pending'&&r.expiresAt>Date.now()&&<div className="row"><Button onClick={async()=>{const session=await act('visitor.accept',{id:r.id});if(session){setDialog(null);navigate('/remote');}}}>Accept</Button><Button onClick={()=>void act('visitor.reject',{id:r.id})}>Reject</Button></div>}</div>)}</div></Modal>}
 {dialog==='profile'&&<Modal title="Demo profile" onClose={()=>setDialog(null)}><div className="stack"><p>{user?.name} · {user?.email}</p><p className="muted">Identity is scoped to this tab. Roles shown here demonstrate frontend policy; production authentication requires a backend.</p>{(role==='BOSS'||db.organizations.length>1)&&<Field label="Workspace"><select value={organization?.id??''} onChange={e=>selectOrganization(e.target.value||undefined)}>{role==='BOSS'&&<option value="">Platform command center</option>}{db.organizations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select></Field>}<Button variant="danger" onClick={()=>{logout();setDialog(null);navigate('/login');}}><LogOut size={18}/> Sign out</Button></div></Modal>}
 </div>;
}
function NotFound(){return <main className="standalone"><Empty state="error" title="This demo page is unavailable" text="The link is unknown or its browser-local demo record no longer exists." action={<Link className="btn primary" to="/welcome">Open Feedar</Link>}/></main>;}
export function App(){if(!demoAvailable)return <Suspense fallback={<LoadingVisual text="Opening Feedar sign in…"/>}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="*" element={<Navigate to="/login" replace/>}/></Routes></Suspense>;return <><NavigationSafety/><StandaloneNotice/><Suspense fallback={<LoadingVisual text="Opening demo workspace…"/>}><Routes><Route path="/" element={<Navigate to={stagingDemo?"/login":"/welcome"} replace/>}/><Route path="/welcome" element={stagingDemo?<Navigate to="/login" replace/>:<WelcomePage/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/o/:slug" element={<PublicOrganizationPage/>}/><Route path="/join/:token" element={<InvitationPage/>}/><Route path="/session/:token" element={<SessionInvitationPage/>}/><Route path="/robot/:robotId/kiosk" element={<KioskPage/>}/><Route element={<Guard/>}><Route element={<Shell/>}><Route path="/overview" element={<OverviewPage/>}/><Route element={<Guard roles={['BOSS','OWNER','ADMIN']}/>}><Route element={<WorkspaceOnly/>}><Route path="/org/info" element={<OrganizationInformationPage/>}/><Route path="/org/users" element={<UsersPermissionsPage/>}/><Route path="/org/robots" element={<OrganizationRobotManagementPage/>}/><Route path="/org/telepresence" element={<SessionPage/>}/></Route></Route><Route element={<Guard roles={['BOSS','OWNER','ADMIN','USER']}/>}><Route element={<WorkspaceOnly/>}><Route path="/org/billing-support" element={<BillingSupportPage/>}/><Route path="/org/status" element={<OrganizationRobotStatusPage/>}/></Route></Route><Route element={<Guard roles={['BOSS']}/>}><Route path="/organizations" element={<OrganizationsPage/>}/><Route path="/robot-management" element={<BossRobotManagementPage/>}/><Route path="/robot-monitoring" element={<BossRobotMonitoringPage/>}/><Route path="/boss/support" element={<BossSupportPage/>}/></Route><Route element={<Guard roles={['BOSS','OWNER','ADMIN']}/>}><Route path="/organizations/:id" element={<OrganizationPage/>}/><Route path="/organization/:id" element={<OrganizationPage/>}/><Route element={<WorkspaceOnly/>}><Route path="/operations" element={<FleetPage/>}/><Route path="/robots" element={<FleetPage/>}/><Route path="/maintenance" element={<FleetPage/>}/><Route path="/members" element={<MembersPage/>}/><Route path="/invitations" element={<InvitationsPage/>}/><Route path="/maps" element={<MapsPage/>}/><Route path="/activity" element={<ActivityPage/>}/></Route><Route element={<WorkspaceOnly/>}><Route path="/robots/:robotId" element={<FleetPage/>}/></Route><Route path="/settings" element={<SettingsPage/>}/></Route><Route element={<Guard roles={['BOSS','OWNER']}/>}><Route element={<WorkspaceOnly/>}><Route path="/knowledge" element={<KnowledgePage/>}/></Route></Route><Route element={<WorkspaceOnly/>}><Route path="/remote" element={<SessionPage/>}/><Route path="/display" element={<KioskPage/>}/></Route></Route></Route><Route path="*" element={<NotFound/>}/></Routes></Suspense></>;}
