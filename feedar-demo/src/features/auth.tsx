import { useState } from 'react';
import { ArrowRight, Bot, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDemo } from '../app/context';
import { Button, Card, FeedarMark, Field, Modal, Badge } from '../components/ui';
import { demoAccounts, DEMO_PASSWORD } from '../data/seed';

export function WelcomePage() {
  return <main className="auth-page welcome-page"><div className="welcome-orbit" aria-hidden="true"><Bot size={96}/></div><div className="welcome-content"><FeedarMark/><p className="kicker">ROBOT CLOUD</p><h1>Connected robots.<br/><span className="gradient-text">Human possibilities.</span></h1><p className="auth-subtitle">Intelligent service robots, connected to people.</p><Link className="btn primary welcome-enter" to="/login">Enter Feedar Cloud <ArrowRight size={19}/></Link><p className="muted">A public, interactive browser demonstration.</p></div><div className="welcome-proof"><span>Telepresence</span><span>Intelligent assistance</span><span>Fleet operations</span></div></main>;
}

const loginSchema = z.object({ email: z.string().trim().min(1,'Enter a demo email or username.').refine(v => /\S+@\S+\.example$/i.test(v)||['boss','owner','admin','user'].includes(v.toLowerCase()), 'Use a fictitious .example email or the username boss, owner, admin, or user.'), password: z.string().min(1, 'Enter the public demo password.') });
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, findDemoIdentity } = useDemo();
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{id:string;organizationId?:string;role:string} | null>(null);
  const [code, setCode] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetText, setResetText] = useState('');
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginValues>({resolver: zodResolver(loginSchema), defaultValues: {email:'boss@feedar.example',password:''}});
  const signIn = handleSubmit(async values => {
    setError(''); setBusy(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    const fixtureEmail=demoAccounts.find(a=>a.userId===values.email.toLowerCase())?.email;
    const account = findDemoIdentity(fixtureEmail??values.email);
    if (values.password !== DEMO_PASSWORD || !account) setError('The demo email or public password does not match. Use a listed account.');
    else if(account.status !== 'active') setError('This demo identity is suspended. Ask the demo Owner or Boss to reactivate it.');
    else {
      const fixture = demoAccounts.find(a=>a.userId===account.id);
      setPending({id:account.id,organizationId:fixture?.organizationId,role:fixture?.role??'OWNER'});
      setCode('');
    }
    setBusy(false);
  });
  function finish() {
    if(code !== '123456') {setError('Use the public demo MFA code 123456.');return;}
    if(!pending)return;
    login(pending.id,pending.organizationId);
    const destination = (location.state as {returnTo?:string}|null)?.returnTo;
    navigate(destination?.startsWith('/') ? destination : pending.role==='USER'?'/remote':'/overview');
  }
  return <main className="auth-page login-page"><div className="login-brand"><Link to="/welcome" aria-label="Feedar welcome"><FeedarMark/></Link><p className="kicker">CONNECTED CARE. CONNECTED PEOPLE.</p><h1>Your robots.<br/>One intelligent<br/><span className="gradient-text">workspace.</span></h1><p className="auth-subtitle">Manage organizations, connect with people, and explore your fleet — all in one place.</p><Badge>Browser demonstration · No real authentication</Badge></div><Card className="login-card"><div className="login-icon"><LockKeyhole size={26}/></div><h2>{pending?'Demo verification':'Welcome back, Boss'}</h2><p className="muted">{pending?'An interactive MFA example. No message was sent.':'Sign in to explore Feedar Cloud with a fictitious identity.'}</p>{pending?<form onSubmit={e=>{e.preventDefault();finish();}} className="stack"><Field label="Demo MFA code"><input inputMode="numeric" autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} maxLength={6} placeholder="123456" autoFocus/></Field><p className="muted">Public demonstration code: <strong>123456</strong>. This does not provide production MFA protection.</p>{error&&<p role="alert" className="error">{error}</p>}<Button type="submit" variant="primary">Enter workspace <ArrowRight size={18}/></Button><Button onClick={()=>{setPending(null);setError('');}}>Back to demo sign-in</Button></form>:<><form onSubmit={signIn} className="stack"><Field label="Email / username"><input {...register('email')} type="text" autoComplete="off" placeholder="boss@feedar.example" aria-invalid={!!errors.email}/></Field>{errors.email&&<p role="alert" className="error">{errors.email.message}</p>}<Field label="Public demo password"><div className="password-field"><input {...register('password')} type={visible?'text':'password'} autoComplete="off" placeholder="FeedarDemo!42" aria-invalid={!!errors.password}/><Button aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</Button></div></Field>{errors.password&&<p role="alert" className="error">{errors.password.message}</p>}<Button className="text-button" onClick={()=>setResetOpen(true)}>Forgot password?</Button>{error&&<p role="alert" className="error">{error}</p>}<Button type="submit" variant="primary" disabled={busy}>{busy?'Checking demo account…':'Sign in'} <ArrowRight size={18}/></Button></form><div className="demo-accounts"><div className="row"><ShieldCheck size={16}/><strong>Use a demo account</strong></div><p className="muted">Public password: <code>{DEMO_PASSWORD}</code>. Never enter a real password.</p><div className="grid-2">{demoAccounts.map(account=><Button key={account.userId} onClick={()=>{setValue('email',account.email);setValue('password',DEMO_PASSWORD);setError('');}}>{account.role==='OWNER'?'Organization Owner':account.role==='BOSS'?'Boss':account.role==='ADMIN'?'Admin':'User'}</Button>)}</div></div></>}<p className="auth-disclaimer">Identity expires after eight hours or logout. Password inputs are never persisted.</p></Card>{resetOpen&&<Modal title="Demo password reset" onClose={()=>setResetOpen(false)}><p className="muted">This static demo has no email service. Use the public password above or generate a copyable example message.</p><form className="stack" onSubmit={e=>{e.preventDefault();setResetText(resetEmail.trim().endsWith('.example')?`DEMO ONLY — Password reset requested for ${resetEmail.trim()}. No email was sent. The public demo password is ${DEMO_PASSWORD}.`:'Use a fictitious .example address.');}}><Field label="Demo email"><input type="email" required value={resetEmail} onChange={e=>setResetEmail(e.target.value)}/></Field><Button type="submit" variant="primary">Generate demo reset message</Button>{resetText&&<textarea readOnly value={resetText} rows={4} aria-label="Copyable reset message"/>}</form></Modal>}</main>;
}
