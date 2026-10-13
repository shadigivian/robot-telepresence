import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Link, useParams } from 'react-router-dom'
import { Activity, ArrowRight, Battery, Bot, Check, CheckCircle2, Clock, Plus, Radio, Search, ShieldAlert, Smartphone, Wrench } from 'lucide-react'
import { useDemo } from '../app/context'
import { Badge, Button, Card, Empty, Field, Modal, PageTitle } from '../components/ui'
import { FloorMap } from '../components/FloorMap'
import type { Robot } from '../domain/models'
import { can } from '../domain/permissions'
import './fleet.css'

const relative = (value: number) => `${Math.max(0, Math.floor((Date.now() - value) / 1000))}s ago`

export function FleetPage() {
  const { db, actor, role, organization, act, notify } = useDemo()
  const { robotId: routeRobotId } = useParams<{ robotId: string }>()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<string | undefined>(routeRobotId)
  useEffect(() => setSelected(routeRobotId), [routeRobotId])
  const [wizard, setWizard] = useState(false)
  const [confirm, setConfirm] = useState<{ robot: Robot; action: string }>()
  const [floorId, setFloorId] = useState('')
  const [page, setPage] = useState(1)
  const manage = ['BOSS', 'OWNER', 'ADMIN'].includes(role)
  const robots = useMemo(() => db.robots.filter(r => (!organization || r.organizationId === organization.id) && (role !== 'USER' || r.assignedUserIds.includes(actor?.userId ?? ''))), [db, organization, role, actor?.userId])
  const visible = robots.filter(r => `${r.name} ${r.serial} ${r.deviceId}`.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || r.connectivity === status || r.mode === status || r.status === status || status === 'fault' && !!r.fault))
  const floors = db.floors.filter(f => !organization || f.organizationId === organization.id)
  const currentFloor = floors.find(f => f.id === floorId) ?? floors[0]
  const createMission = !!actor && can(db, actor, 'mission.create', currentFloor?.organizationId ?? organization?.id)
  const active = db.maps.find(m => m.floorId === currentFloor?.id && m.active)
  const details = robots.find(r => r.id === selected)
  const online = robots.filter(r => r.connectivity === 'online' && r.status === 'active').length
  const incidents = db.incidents.filter(i => (!organization || i.organizationId === organization.id) && i.status === 'open' && robots.some(r => r.id === i.robotId))
  if (routeRobotId && !robots.some(r => r.id === routeRobotId)) return <Empty title="Robot unavailable" text="This robot is unknown or is outside your permitted demo assignments or organization." />
  return <>
    <PageTitle title="Robot operations" subtitle="Your people, places, and robots. Connected in one workspace." />
    <div className="toolbar"><div className="row"><Badge>Browser simulator</Badge><span className="muted">{organization?.name ?? 'Platform fleet'}</span></div>{manage && <div className="row"><Button onClick={() => setWizard(true)} variant="primary"><Plus size={16} /> Add robot</Button><Button variant="danger" onClick={() => void act('robot.estopAll', { organizationId: organization?.id }).then(result => result && notify('Simulated software stop requested. Review acknowledgments in robot details.'))}><ShieldAlert size={16} /> Emergency stop all</Button></div>}</div>
    <div className="grid-4 fleet-kpis">
      <Card><span className="kicker">Fleet online</span><strong>{online}<small> / {robots.length}</small></strong><span className="muted"><Radio size={14} /> Same-browser demo telemetry</span></Card>
      <Card><span className="kicker">Active sessions</span><strong>{db.sessions.filter(s => robots.some(r => r.id === s.robotId) && ['connected', 'connecting'].includes(s.status)).length}</strong><span className="muted">Authorized local participants</span></Card>
      <Card><span className="kicker">Average battery</span><strong>{robots.length ? Math.round(robots.reduce((sum, r) => sum + r.battery, 0) / robots.length) : 0}<small>%</small></strong><span className="muted"><Battery size={14} /> Simulated diagnostics</span></Card>
      <Card><span className="kicker">Open incidents</span><strong>{incidents.length}</strong><span className="muted"><Activity size={14} /> Attention required</span></Card>
    </div>
    <div className="operations-layout">
      <Card className="operations-map"><div className="toolbar"><div><span className="kicker">Location overview</span><h2>Floor map</h2></div><select aria-label="Operations floor" value={currentFloor?.id ?? ''} onChange={e => setFloorId(e.target.value)}>{floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div><MapWithBlob blob={active?.blob} floorName={currentFloor?.name} points={db.points.filter(p => p.floorId === currentFloor?.id).map(p => ({ ...p, label: p.name }))} robots={robots.filter(r => r.floorId === currentFloor?.id && r.status === 'active')} /><div className="toolbar"><span className="muted">Positions are simulated; localization is not installed.</span>{createMission && <Link className="btn" to="/maps">Create mission <ArrowRight size={15} /></Link>}</div></Card>
      <div className="stack"><Card><span className="kicker">Fleet at a glance</span><h2>Ready when you are</h2><div className="robot-mini-list">{robots.filter(r => r.status !== 'archived').slice(0, 3).map(r => <button key={r.id} className="robot-mini" onClick={() => setSelected(r.id)}><span className="robot-avatar"><Bot size={22} /></span><span><strong>{r.name}</strong><small>{r.serial} · {db.floors.find(f => f.id === r.floorId)?.name}</small></span><Badge>{r.fault ? 'Fault' : r.mode === 'telepresence' ? 'In call' : r.connectivity}</Badge><span>{Math.round(r.battery)}%</span></button>)}</div></Card><Card><span className="kicker">Incident feed</span>{incidents.length ? incidents.slice(0, 3).map(i => <div className="incident-row" key={i.id}><ShieldAlert size={17} /><div><strong>{i.title}</strong><small>{i.severity} · {new Date(i.createdAt).toLocaleTimeString()}</small></div></div>) : <p className="muted">No open incidents for this fleet.</p>}<p className="muted">Hardware health and serial connections below are simulated.</p></Card></div>
    </div>
    <Card><div className="toolbar"><h2>Robot inventory <span className="muted">{visible.length}</span></h2><div className="row"><label className="search-field"><Search size={16} /><input aria-label="Search robots" placeholder="Search name or device…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></label><select aria-label="Filter robot status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="all">All states</option>{['online', 'offline', 'charging', 'maintenance', 'fault', 'suspended', 'archived'].map(s => <option key={s}>{s}</option>)}</select></div></div>
      {visible.length ? <div className="table-wrap"><table><thead><tr><th>Robot / device</th><th>Status</th><th>Location</th><th>Battery</th><th>Mode</th><th>Contact</th><th>Assigned users</th><th>Actions</th></tr></thead><tbody>{visible.slice((page - 1) * 6, page * 6).map(r => <tr key={r.id}><td><button className="text-button" onClick={() => setSelected(r.id)}><strong>{r.name} / {r.serial}</strong></button><small>{r.deviceId}</small></td><td><Badge>{r.status === 'active' ? r.connectivity : r.status}</Badge>{r.fault && <small className="danger-text">{r.fault}</small>}</td><td>{db.floors.find(f => f.id === r.floorId)?.name ?? 'Unassigned'}<small>{db.organizations.find(o => o.id === r.organizationId)?.name}</small></td><td><span className={`battery ${r.battery < 20 ? 'low' : ''}`}><Battery size={16} />{Math.round(r.battery)}%</span></td><td>{r.mode}{r.currentSessionId && <small>Session active</small>}</td><td>{relative(r.telemetry.timestamp)}</td><td>{r.assignedUserIds.length ? r.assignedUserIds.map(id => db.users.find(u => u.id === id)?.name).filter(Boolean).join(', ') : 'No assignments'}</td><td><div className="row"><Button onClick={() => setSelected(r.id)}>Details</Button><Link className="btn primary" to={`/remote?robot=${encodeURIComponent(r.id)}`}>Open control</Link>{manage && r.status !== 'archived' && <Button variant="ghost" onClick={() => setConfirm({ robot: r, action: r.status === 'suspended' ? 'reactivate' : 'suspend' })}>{r.status === 'suspended' ? 'Reactivate' : 'Suspend'}</Button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No robots match" text="Try a different search or add a demo robot." />}
      <div className="pagination"><span className="muted">{visible.length} robots · page {page} of {Math.max(1, Math.ceil(visible.length / 6))}</span><Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><Button disabled={page * 6 >= visible.length} onClick={() => setPage(p => p + 1)}>Next</Button></div>
    </Card>
    {wizard && <RobotWizard onClose={() => setWizard(false)} />}
    {details && <RobotDetails robot={details} onClose={() => setSelected(undefined)} />}
    {confirm && <Modal title={`${confirm.action} ${confirm.robot.name}?`} onClose={() => setConfirm(undefined)}><p>This updates local demo access. Suspending invalidates sessions and stops simulated movement.</p><Button variant="danger" onClick={() => { void act(confirm.action === 'reactivate' ? 'robot.update' : 'robot.suspend', { id: confirm.robot.id, status: 'active' }); setConfirm(undefined) }}>Confirm {confirm.action}</Button></Modal>}
  </>
}

function MapWithBlob({ blob, ...props }: React.ComponentProps<typeof FloorMap> & { blob?: Blob }) {
  const url = useBlobUrl(blob)
  return <FloorMap {...props} imageUrl={url} />
}

export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) { setUrl(undefined); return }
    const value = URL.createObjectURL(blob); setUrl(value)
    return () => URL.revokeObjectURL(value)
  }, [blob])
  return url
}

function RobotWizard({ onClose }: { onClose: () => void }) {
  const { db, organization, act, notify } = useDemo()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [id, setId] = useState<string>()
  const [orgId, setOrgId] = useState(organization?.id ?? db.organizations.find(o => o.status === 'active')?.id ?? '')
  const [floorId, setFloorId] = useState(db.floors.find(f => f.organizationId === orgId)?.id ?? '')
  const [name, setName] = useState('')
  const [serial, setSerial] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [code, setCode] = useState('')
  const [tested, setTested] = useState(false)
  const [assigned, setAssigned] = useState<string[]>([])
  const robot = db.robots.find(r => r.id === id)
  const steps = ['Location', 'Device', 'Pairing', 'Test', 'Assignments', 'Activate']
  const run = async (task: () => Promise<void>) => { setBusy(true); try { await task() } finally { setBusy(false) } }
  return <Modal title="Add a demo robot" onClose={onClose}><ol className="wizard-steps">{steps.map((s, i) => <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''}><span>{i < step ? <Check size={12} /> : i + 1}</span>{s}</li>)}</ol>
    <p className="muted">Pairing and connection tests are simulated. No real device credentials or hardware access are created.</p>
    <form onSubmit={event => { event.preventDefault(); void run(async () => {
      if (step === 0) setStep(1)
      else if (step === 1) { const created = await act('robot.create', { organizationId: orgId, floorId, locationId: db.floors.find(f => f.id === floorId)?.locationId, name, serial, deviceId }); if (created) { setId(created); setStep(2) } }
      else if (step === 2 && id) { await act('robot.pair', { id, robotId: id, code, organizationId: orgId }); }
      else if (step === 3 && id) { const checked = await act('robot.test', { id }); if (checked) setTested(true) }
      else if (step === 4 && id) { let saved = true; for (const userId of assigned) if (!await act('robot.assign', { id, robotId: id, userId, capabilities: ['video', 'chat', 'screen', 'control'] })) saved = false; if (saved) setStep(5) }
      else if (step === 5 && id) { const activated = await act('robot.activate', { id }); if (activated) { notify('Demo robot activated. Open details to inspect simulated telemetry.'); onClose() } }
    }) }}>
      {step === 0 && <div className="form-grid"><Field label="Organization"><select required disabled={!!organization} value={orgId} onChange={e => { setOrgId(e.target.value); setFloorId(db.floors.find(f => f.organizationId === e.target.value)?.id ?? '') }}>{db.organizations.filter(o => o.status === 'active').map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label="Branch / floor"><select required value={floorId} onChange={e => setFloorId(e.target.value)}><option value="">Select a floor</option>{db.floors.filter(f => f.organizationId === orgId).map(f => <option key={f.id} value={f.id}>{db.locations.find(l => l.id === f.locationId)?.name} / {f.name}</option>)}</select></Field></div>}
      {step === 1 && <div className="stack"><Field label="Robot name"><input required maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Nola" /></Field><div className="form-grid"><Field label="Serial / fleet label"><input required maxLength={60} value={serial} onChange={e => setSerial(e.target.value)} placeholder="R-11" /></Field><Field label="Demo device identifier"><input required pattern="[A-Za-z0-9_-]{3,80}" value={deviceId} onChange={e => setDeviceId(e.target.value)} placeholder="FD-DEMO-0011" /></Field></div></div>}
      {step === 2 && <div className="stack"><div className="pairing-card"><PairingQr code={robot?.pairingCode} organizationId={orgId} /><Smartphone size={36} /><div><span className="kicker">Simulated pairing code</span><strong>{robot?.pairingCode ?? 'Generating…'}</strong><small>Expires {robot?.pairingExpiresAt ? new Date(robot.pairingExpiresAt).toLocaleTimeString() : 'soon'} · organization bound</small></div></div><Field label="Enter code shown above"><input required value={code} onChange={e => setCode(e.target.value)} placeholder="Demo pairing code" /></Field><div className="row"><Badge>{robot?.pairing ?? 'pending'}</Badge>{robot?.pairing === 'paired' && <Button type="button" variant="primary" onClick={() => setStep(3)}>Continue to test <ArrowRight size={15} /></Button>}<Button type="button" onClick={() => id && void act('robot.rotate', { id })}>Regenerate code</Button></div><p className="muted">Wrong organization or expired codes are rejected by the demo provider.</p></div>}
      {step === 3 && <div className="test-connection"><Radio size={40} /><h3>{tested ? 'Demo connection checked' : 'Test simulated connection'}</h3><p className="muted">Surface, serial, heartbeat, and camera results are fixture states. No COM port is opened.</p>{tested && <><p><CheckCircle2 size={17} /> Simulated heartbeat received</p><Button type="button" onClick={() => setStep(4)} variant="primary">Continue to assignments</Button></>}</div>}
      {step === 4 && <div className="stack"><p>Assign ordinary users to this robot. Control still requires a separate session grant.</p>{db.memberships.filter(m => m.organizationId === orgId && m.role === 'USER' && m.status === 'active').map(m => <label className="check-row" key={m.id}><input type="checkbox" checked={assigned.includes(m.userId)} onChange={e => setAssigned(a => e.target.checked ? [...a, m.userId] : a.filter(id => id !== m.userId))} />{db.users.find(u => u.id === m.userId)?.name}</label>)}</div>}
      {step === 5 && <div className="test-connection"><Bot size={48} /><h3>{name} is ready for the browser fleet</h3><p>Paired to {db.organizations.find(o => o.id === orgId)?.name}, {assigned.length} user assignments.</p><p className="muted">Activation starts at zero velocity. This is simulated hardware.</p></div>}
      <div className="modal-actions">{step < 2 && step > 0 && <Button type="button" onClick={() => setStep(s => s - 1)}>Back</Button>}<Button type="button" onClick={onClose}>Close</Button>{!(step === 2 && robot?.pairing === 'paired') && !(step === 3 && tested) && <Button disabled={busy} type="submit" variant="primary">{busy ? 'Working…' : ['Next', 'Create demo device', 'Pair demo device', 'Run connection test', 'Save assignments', 'Activate robot'][step]}</Button>}</div>
    </form>
  </Modal>
}

function PairingQr({ code, organizationId }: { code?: string; organizationId: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let active = true
    if (!code) { setSrc(undefined); return }
    void QRCode.toDataURL(`feedar-demo-pair:${organizationId}:${code}`, { width: 100, margin: 1 }).then(value => { if (active) setSrc(value) }).catch(() => { if (active) setSrc(undefined) })
    return () => { active = false }
  }, [code, organizationId])
  return src ? <img width="100" height="100" src={src} alt="Simulated pairing code QR; no real credentials" /> : null
}

function RobotDetails({ robot, onClose }: { robot: Robot; onClose: () => void }) {
  const { db, role, act } = useDemo()
  const [tab, setTab] = useState('telemetry')
  const [name, setName] = useState(robot.name)
  const [floor, setFloor] = useState(robot.floorId)
  const [maintenance, setMaintenance] = useState('')
  const [assign, setAssign] = useState('')
  const [scenario, setScenario] = useState('offline')
  const [confirm, setConfirm] = useState<string>()
  const manage = ['BOSS', 'OWNER', 'ADMIN'].includes(role)
  const t = robot.telemetry
  return <Modal title={`${robot.name} / ${robot.serial}`} onClose={onClose}><div className="toolbar"><Badge>{robot.connectivity} · {robot.mode}</Badge><span className="muted">Demo device · {robot.deviceId}</span></div><div className="tabs" role="tablist" aria-label="Robot detail sections">{['telemetry', 'assignments', 'maintenance', 'history', ...(manage ? ['settings', 'scenarios'] : [])].map(s => <button role="tab" aria-selected={tab === s} className={tab === s ? 'active' : ''} key={s} onClick={() => setTab(s)}>{s}</button>)}</div>
    {tab === 'telemetry' && <><div className="metric-grid">{[['Battery', `${Math.round(robot.battery)}%`], ['Voltage / current', `${t.voltage ?? 'Unavailable'} V / ${t.current ?? 'Unavailable'} A`], ['Speed', `${t.linear.toFixed(2)} m/s`], ['Heading', `${(robot.heading * 180 / Math.PI).toFixed(1)}° (simulated)`], ['Left / right wheel', `${t.leftWheel.toFixed(2)} / ${t.rightWheel.toFixed(2)} m/s`], ['Latency / signal', `${t.latency} ms / ${t.signal}%`], ['Temperature', `${t.temperature}°C`], ['Last heartbeat', relative(t.timestamp)], ['Surface agent', t.surfaceConnected ? 'Demo connected' : 'Unavailable'], ['ESP32 / serial', t.serialConnected ? 'Simulated connection' : 'Unavailable'], ['Camera / microphone', `${t.camera ? 'Demo available' : 'Not installed'} / ${t.microphone ? 'Demo available' : 'Not installed'}`], ['Docking', robot.mode === 'charging' ? 'Simulated charging' : 'Not docked'], ['Pairing / generation', `${robot.pairing} / ${robot.credentialGeneration}`], ['Agent / firmware', `${robot.agentVersion} / ${robot.firmwareVersion}`], ['Software stop', `${robot.estop ? 'Latched' : 'Ready'} · ${robot.stopState}`], ['Fault / obstacle', `${robot.fault ?? 'None'} / ${t.obstacle ? 'Flagged' : 'Clear (simulated)'}`]].map(([label, value]) => <div key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</div><p className="muted">Capabilities: {robot.capabilities.join(', ') || 'Not installed'}. Position {robot.x.toFixed(1)}%, {robot.y.toFixed(1)}% is a browser simulation, not measured localization.</p></>}
    {tab === 'assignments' && <div className="stack">{robot.assignedUserIds.map(id => <div className="toolbar" key={id}><span>{db.users.find(u => u.id === id)?.name ?? id}</span>{manage && <Button onClick={() => void act('robot.unassign', { id: robot.id, robotId: robot.id, userId: id })}>Unassign</Button>}</div>)}{!robot.assignedUserIds.length && <p className="muted">No users assigned.</p>}{manage && <form className="row" onSubmit={e => { e.preventDefault(); void act('robot.assign', { id: robot.id, robotId: robot.id, userId: assign, capabilities: ['video', 'chat', 'screen', 'control_request'] }); setAssign('') }}><select required aria-label="User to assign" value={assign} onChange={e => setAssign(e.target.value)}><option value="">Select ordinary user</option>{db.memberships.filter(m => m.organizationId === robot.organizationId && m.role === 'USER' && m.status === 'active' && !robot.assignedUserIds.includes(m.userId)).map(m => <option key={m.id} value={m.userId}>{db.users.find(u => u.id === m.userId)?.name}</option>)}</select><Button type="submit">Assign user</Button></form>}</div>}
    {tab === 'maintenance' && <div className="stack"><div className="row"><Wrench size={22} /><h3>Maintenance & demo releases</h3></div><p className="muted">Maintenance, reboot, and update stop simulation first. Movement never resumes automatically.</p>{manage && <><div className="row"><Button onClick={() => void act('robot.update', { id: robot.id, mode: robot.mode === 'maintenance' ? 'welcome' : 'maintenance' })}>{robot.mode === 'maintenance' ? 'Leave maintenance' : 'Enter maintenance'}</Button><Button onClick={() => setConfirm('reboot')}>Simulate reboot</Button><Button onClick={() => setConfirm('update')}>Simulate update</Button></div><form className="form-grid" onSubmit={e => { e.preventDefault(); void act('robot.update', { id: robot.id, maintenanceAt: new Date(maintenance).getTime() }) }}><Field label="Schedule maintenance"><input required type="datetime-local" value={maintenance} onChange={e => setMaintenance(e.target.value)} /></Field><Button type="submit">Save schedule</Button></form></>}{robot.maintenanceAt && <p><Clock size={15} /> Scheduled {new Date(robot.maintenanceAt).toLocaleString()}</p>}{db.releases.filter(r => r.robotId === robot.id).map(r => <div key={r.id} className="toolbar"><span>{r.name} · {r.version}</span><Badge>{r.status} {r.progress}%</Badge></div>)}<p className="muted">Battery analytics, signed OTA, and rollback require backend/hardware integration.</p></div>}
    {tab === 'history' && <div className="stack"><h3>Session history</h3>{db.sessions.filter(s => s.robotId === robot.id).map(s => <div key={s.id} className="toolbar"><span>{db.users.find(u => u.id === s.userId)?.name} · {new Date(s.createdAt).toLocaleString()}</span><Badge>{s.status}</Badge></div>)}<h3>Command & device history</h3>{db.audits.filter(a => a.robotId === robot.id || a.entityId === robot.id).slice(-15).reverse().map(a => <div className="history-item" key={a.id}><strong>{a.action}</strong><small>{new Date(a.createdAt).toLocaleString()} · {a.outcome}</small><span className="muted">{a.summary}</span></div>)}<p className="muted">Local audit records are not tamper-proof.</p></div>}
    {tab === 'settings' && manage && <div className="stack"><form className="stack" onSubmit={e => { e.preventDefault(); void act('robot.update', { id: robot.id, name, floorId: floor }) }}><Field label="Robot name"><input required maxLength={60} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Floor"><select value={floor} onChange={e => setFloor(e.target.value)}>{db.floors.filter(f => f.organizationId === robot.organizationId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field><Button type="submit" variant="primary">Save robot</Button></form><div className="row"><Button onClick={() => setConfirm('unpair')}>Unpair / revoke device</Button><Button onClick={() => void act('robot.rotate', { id: robot.id })}>Rotate demo credentials</Button><Button variant="danger" onClick={() => setConfirm('archive')}>Archive robot</Button></div></div>}
    {tab === 'scenarios' && manage && <div className="stack"><h3>Controlled demo scenarios</h3><p className="muted">Each scenario affects this simulated robot only. Faults and disconnects stop movement.</p><Field label="Scenario"><select value={scenario} onChange={e => setScenario(e.target.value)}>{['offline', 'serial_disconnect', 'low_battery', 'busy', 'control_revocation', 'latency', 'obstacle', 'update_failure', 'emergency_stop', 'restore'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></Field><Button variant="primary" onClick={() => void act('robot.scenario', { id: robot.id, scenario })}>Apply demo scenario</Button><Button onClick={() => void act('robot.resetStop', { id: robot.id })}>Reset simulated stop latch</Button><p className="muted">Resetting restores zero command and does not initiate movement.</p></div>}
    {confirm && <div className="confirmation-box"><h3>Confirm {confirm}</h3><p>This modifies the local demo device and stops affected simulated movement.</p><div className="row"><Button onClick={() => setConfirm(undefined)}>Cancel</Button><Button variant="danger" onClick={() => { void act(confirm === 'update' ? 'update.start' : `robot.${confirm}`, { id: robot.id, robotId: robot.id }); setConfirm(undefined) }}>Confirm</Button></div></div>}
  </Modal>
}
