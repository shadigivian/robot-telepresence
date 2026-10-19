import { useState } from 'react';
import { ArrowRight, Bot, Building2, Eye, EyeOff, LockKeyhole, ShieldCheck, Activity, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDemo } from '../app/context';
import { ThemeToggle } from '../app/theme';
import { Button, Card, FeedarMark, Field, Badge } from '../components/ui';
import { demoAccounts, DEMO_PASSWORD } from '../data/seed';
import {demoDevelopment,stagingDemo,stagingRoleAllowed,surface,surfaceConfig} from '../app/runtime';

export function WelcomePage() {
  return <main className="auth-page welcome-page"><ThemeToggle className="standalone-theme-toggle"/><div className="welcome-orbit" aria-hidden="true"><Bot size={96}/></div><div className="welcome-content"><FeedarMark/><p className="kicker">ROBOT CLOUD</p><h1>Connected robots.<br/><span className="gradient-text">Human possibilities.</span></h1><p className="auth-subtitle">Intelligent service robots, connected to people.</p><Link className="btn primary welcome-enter" to="/login">Enter Feedar Cloud <ArrowRight size={19}/></Link><p className="muted">A public, interactive browser demonstration.</p></div><div className="welcome-proof"><span>Telepresence</span><span>Intelligent assistance</span><span>Fleet operations</span></div></main>;
}

const loginSchema = z.object({ email: z.string().trim().min(1,'Enter a demo email or username.').refine(v => /\S+@\S+\.example$/i.test(v)||['boss','owner','admin','user'].includes(v.toLowerCase()), 'Use a fictitious .example email or the username boss, owner, admin, or user.'), password: z.string().min(1, 'Enter the public demo password.') });
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage(){return demoDevelopment?<DemoLoginPage/>:stagingDemo?<StagingLoginPage/>:<OperationalLoginPage/>;}
function StagingLoginPage(){const demo=useDemo();return <OperationalLoginPage staging={demo}/>;}
function OperationalLoginPage({staging}:{staging?:ReturnType<typeof useDemo>}){
  const navigate=useNavigate();
  const central=surface==='boss';
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [visible,setVisible]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [attempted,setAttempted]=useState(false);
  const [pending,setPending]=useState<{id:string;organizationId?:string;role:string}|null>(null);
  const [code,setCode]=useState('');
  const emailError=attempted&&(!email.trim()?'Enter your email address.':!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())?'Enter a valid email address.':'');
  const passwordError=attempted&&!password?'Enter your password.':'';
  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setAttempted(true);setError('');
    if(pending){
      if(code!=='123456'){setError('The verification code is incorrect.');return;}
      if(!staging?.login(pending.id,pending.organizationId)){setError('This demo account is unavailable.');return;}
      navigate(pending.role==='USER'?'/remote':'/overview');return;
    }
    if(!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||!password)return;
    setBusy(true);
    await new Promise(resolve=>window.setTimeout(resolve,350));
    if(staging){
      const account=staging.findDemoIdentity(email.trim());
      const fixture=demoAccounts.find(item=>item.userId===account?.id);
      if(password!==DEMO_PASSWORD||!account||!fixture){setError('Email or password is incorrect.');}
      else if(account.status!=='active'){setError('This account is unavailable.');}
      else if(!stagingRoleAllowed(surface,fixture.role)){setError('This account cannot sign in on this workspace.');}
      else{setPending({id:account.id,organizationId:fixture.organizationId,role:fixture.role});setCode('');}
    }else setError(surfaceConfig.apiOrigin?'The authentication service is not connected to this application yet. Please contact your administrator.':'Sign in is currently unavailable because the authentication service is not configured.');
    setBusy(false);
  };
  return <main className={`operational-login ${central?'boss-login':'organization-login'}`}>
    <div className="operational-shell">
      <header className="operational-header"><FeedarMark/><ThemeToggle className="theme-toggle"/></header>
      <div className="operational-layout">
        {central?<section className="login-story boss-story"><span className="story-eyebrow"><span className="story-dot"/> FEEDAR · COMMAND PLATFORM</span><div className="boss-illustration" aria-hidden="true"><div className="boss-orbit orbit-one"/><div className="boss-orbit orbit-two"/><div className="boss-hub"><Bot size={43}/></div><span className="orbit-node node-one"><Building2 size={20}/></span><span className="orbit-node node-two"><Activity size={20}/></span><span className="orbit-node node-three"><Users size={20}/></span></div><h1>Every operation.<br/><span>One clear view.</span></h1><p>Lead organizations, monitor your fleet, and keep service moving from one central workspace.</p><div className="story-footer"><ShieldCheck size={17}/> CENTRAL ADMINISTRATION</div></section>:<section className="login-story organization-story"><span className="story-eyebrow"><span className="story-dot"/> FEEDAR · ORGANIZATION WORKSPACE</span><div className="organization-illustration" aria-hidden="true"><div className="org-glow"/><div className="org-device"><div className="org-device-top"><span/><span/><span/></div><div className="org-device-content"><div className="org-robot"><Bot size={42}/></div><div className="org-device-lines"><i/><i/><i/></div></div><div className="org-device-bottom"><span/><span/><span/></div></div><span className="org-float org-float-one"><Activity size={18}/></span><span className="org-float org-float-two"><Users size={18}/></span></div><h1>Closer connections.<br/><span>Better care.</span></h1><p>Bring your people, robots, and daily work together in a calm, connected space.</p><div className="story-footer"><Building2 size={17}/> YOUR ORGANIZATION WORKSPACE</div></section>}
        <section className="operational-card" aria-labelledby="operational-title"><div className="card-icon">{central?<ShieldCheck size={25}/>:<Bot size={25}/>}</div><p className="card-eyebrow">{central?'CENTRAL ADMINISTRATION':'ORGANIZATION ACCESS'}</p><h2 id="operational-title">{central?'Feedar Control Center':'Welcome to Feedar'}</h2><p className="card-subtitle">{central?'Sign in to manage the Feedar platform.':'Your workspace for connected robots'}</p><form className="operational-form" onSubmit={submit} noValidate>{pending?<><label htmlFor="staging-code">Verification code</label><input id="staging-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event=>setCode(event.target.value)} maxLength={6}/></>:<><label htmlFor="operational-email">Email</label><input id="operational-email" type="email" autoComplete="username" inputMode="email" value={email} onChange={event=>setEmail(event.target.value)} aria-invalid={!!emailError} aria-describedby={emailError?'email-error':undefined} placeholder="name@organization.com"/><>{emailError&&<p className="field-error" id="email-error">{emailError}</p>}</><label htmlFor="operational-password">Password</label><div className="operational-password"><input id="operational-password" type={visible?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} aria-invalid={!!passwordError} aria-describedby={passwordError?'password-error':undefined} placeholder="Enter your password"/><button type="button" onClick={event=>{setVisible(value=>!value);if(event.detail>0){const input=event.currentTarget.previousElementSibling;if(input instanceof HTMLInputElement)input.focus({preventScroll:true});}}} aria-label={visible?'Hide password':'Show password'} aria-pressed={visible}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{passwordError&&<p className="field-error" id="password-error">{passwordError}</p>}</>}{error&&<p role="alert" className="login-service-error"><ShieldCheck size={18}/>{error}</p>}<button className="operational-submit" type="submit" disabled={busy}>{busy?'Checking availability…':pending?'Enter workspace':'Sign In'}{!busy&&<ArrowRight size={18}/>}</button>{pending&&<button type="button" className="theme-toggle" onClick={()=>{setPending(null);setCode('');setError('');}}>Back</button>}</form><div className="card-bottom"><LockKeyhole size={15}/><span>{staging?'Protected staging demo · browser-local simulation.':'Access is available when secure authentication is configured.'}</span></div></section>
      </div><footer className="operational-footer"><span>© Feedar Cloud</span><span>Connected to people.</span></footer>
    </div>
  </main>;
}
function DemoLoginPage() {
  const { login, findDemoIdentity } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{id:string;organizationId?:string;role:string} | null>(null);
  const [code, setCode] = useState('');
   const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({resolver: zodResolver(loginSchema), defaultValues: {email:'',password:''}});
  const signIn = handleSubmit(async values => {
    setError(''); setBusy(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    const fixtureEmail=demoAccounts.find(a=>a.userId===values.email.toLowerCase())?.email;
    const account = findDemoIdentity(fixtureEmail??values.email);
    if (values.password !== DEMO_PASSWORD || !account) setError('The fictitious email or public demo password does not match a member saved in this browser.');
    else if(account.status !== 'active') setError('This demo identity is suspended. Ask the demo Owner or Boss to reactivate it.');
    else {
      const fixture = demoAccounts.find(a=>a.userId===account.id);
      setPending({id:account.id,organizationId:fixture?.organizationId,role:fixture?.role??'MEMBER'});
      setCode('');
    }
    setBusy(false);
  });
  function finish() {
    if(code !== '123456') {setError('Use the public demo MFA code 123456.');return;}
    if(!pending)return;
    if(!login(pending.id,pending.organizationId)){setError('This demo identity, membership, or organization is suspended or unavailable.');return;}
    const destination = (location.state as {returnTo?:string}|null)?.returnTo;
    navigate(destination?.startsWith('/') ? destination : pending.role==='USER'?'/remote':'/overview');
  }
  return <main className="auth-page login-page"><ThemeToggle className="standalone-theme-toggle"/><div className="login-brand"><Link to="/welcome" aria-label="Feedar welcome"><FeedarMark/></Link><p className="kicker">CONNECTED CARE. CONNECTED PEOPLE.</p><h1>Your robots.<br/>One intelligent<br/><span className="gradient-text">workspace.</span></h1><p className="auth-subtitle">Manage organizations, connect with people, and explore your fleet — all in one place.</p><Badge>Browser demonstration · No real authentication</Badge></div><Card className="login-card"><div className="login-icon"><LockKeyhole size={26}/></div><h2>{pending?'Demo verification':'Demo member sign in'}</h2><p className="muted">{pending?'An interactive MFA example. No message was sent.':'Use a seeded account or a fictitious member email accepted through an invitation in this browser.'}</p>{pending?<form onSubmit={e=>{e.preventDefault();finish();}} className="stack"><Field label="Demo MFA code"><input inputMode="numeric" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} maxLength={6} placeholder="123456" autoFocus/></Field><p className="muted">Public demonstration code: <strong>123456</strong>. This does not provide production MFA protection.</p>{error&&<p role="alert" className="error">{error}</p>}<Button type="submit" variant="primary">Enter workspace <ArrowRight size={18}/></Button><Button onClick={()=>{setPending(null);setError('');}}>Back to demo sign-in</Button></form>:<><form onSubmit={signIn} className="stack"><Field label="Email / username"><input {...register('email')} type="text" autoComplete="off" placeholder="name@example.com" aria-invalid={!!errors.email}/></Field>{errors.email&&<p role="alert" className="error">{errors.email.message}</p>}<Field label="Public demo password"><div className="password-field"><input {...register('password')} type={visible?'text':'password'} autoComplete="off" placeholder="Enter password" aria-invalid={!!errors.password}/><Button type="button" className="password-visibility" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={event=>{setVisible(value=>!value);if(event.detail>0){const input=event.currentTarget.previousElementSibling;if(input instanceof HTMLInputElement)input.focus({preventScroll:true});}}}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</Button></div></Field>{errors.password&&<p role="alert" className="error">{errors.password.message}</p>}{error&&<p role="alert" className="error">{error}</p>}<Button type="submit" variant="primary" disabled={busy}>{busy?'Checking demo account…':'Sign in'} <ArrowRight size={18}/></Button></form></>}<p className="auth-disclaimer">Identity expires after eight hours or logout. Password inputs are never persisted.</p></Card></main>;
}
