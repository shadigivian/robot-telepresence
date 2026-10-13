import { useState, type ChangeEvent } from 'react'
import { Flag, MapPin, Pause, Play, Plus, Trash2, Upload } from 'lucide-react'
import { useDemo } from '../app/context'
import { Badge, Button, Card, Empty, Field, Modal, PageTitle } from '../components/ui'
import { FloorMap } from '../components/FloorMap'
import { useBlobUrl } from './fleet'
import type { MapPoint } from '../domain/models'
import { can } from '../domain/permissions'
import './fleet.css'

const allowedImages = ['image/png', 'image/jpeg', 'image/webp']
const maxImage = 5 * 1024 * 1024
export function MapsPage() {
  const { db, actor, organization, act, notify } = useDemo()
  const [orgId, setOrgId] = useState(organization?.id ?? db.organizations[0]?.id ?? '')
  const scopedOrgId = organization?.id ?? orgId
  const [floorId, setFloorId] = useState('')
  const floors = db.floors.filter(f => f.organizationId === scopedOrgId)
  const floor = floors.find(f => f.id === floorId) ?? floors[0]
  const maps = db.maps.filter(m => m.floorId === floor?.id)
  const activeMap = maps.find(m => m.active)
  const image = useBlobUrl(activeMap?.blob)
  const points = db.points.filter(p => p.floorId === floor?.id)
  const robots = db.robots.filter(r => r.organizationId === scopedOrgId && r.floorId === floor?.id && r.status === 'active')
  const [selectedPoint, setSelectedPoint] = useState('')
  const [robotId, setRobotId] = useState('')
  const selectedRobot = robots.find(r => r.id === robotId) ?? robots[0]
  const [editing, setEditing] = useState<Partial<MapPoint>>()
  const [placing, setPlacing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; action: string; name: string }>()
  const [locationModal, setLocationModal] = useState(false)
  const [branchName, setBranchName] = useState('')
  const [newFloor, setNewFloor] = useState('')
  const [branchId, setBranchId] = useState('')
  const manage = !!actor && can(db, actor, 'map.create', scopedOrgId)
  const manageMissions = !!actor && can(db, actor, 'mission.create', scopedOrgId)
  const missions = db.missions.filter(m => m.organizationId === scopedOrgId)
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !manage) return
    if (!allowedImages.includes(file.type) || file.size > maxImage || file.size === 0) { notify('Use PNG, JPEG, or WebP, up to 5 MB. SVG and HTML are not supported.'); return }
    try {
      const bitmap = await createImageBitmap(file)
      const dimensionsOk = bitmap.width <= 10000 && bitmap.height <= 10000
      bitmap.close()
      if (!dimensionsOk) { notify('Image dimensions must be at most 10,000 × 10,000.'); return }
    } catch { notify('This file could not be decoded as an image.'); return }
    await act('map.create', { organizationId: scopedOrgId, floorId: floor?.id, name: file.name, blob: file, coordinates: 'percent' })
  }
  return <>
    <PageTitle title="Maps & locations" subtitle="A place for every robot. Plan and explore a simulated journey." />
    <div className="toolbar"><div className="row">{!organization && <select aria-label="Map organization" value={orgId} onChange={e => { setOrgId(e.target.value); setFloorId(''); setSelectedPoint('') }}>{db.organizations.filter(o => o.status === 'active').map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}<select aria-label="Map floor" value={floor?.id ?? ''} onChange={e => { setFloorId(e.target.value); setSelectedPoint('') }}>{floors.map(f => <option key={f.id} value={f.id}>{db.locations.find(l => l.id === f.locationId)?.name} / {f.name}</option>)}</select><Badge>Image percentage coordinates</Badge></div>{manage && <div className="row"><Button onClick={() => setLocationModal(true)}><Plus size={16} /> Branch / floor</Button><label className="btn primary upload-button"><Upload size={16} /> Upload floor plan<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void upload(e)} /></label></div>}</div>
    {!floor ? <Empty title="No floors yet" text="Create a branch and floor to upload a map." /> : <div className="maps-layout"><Card><div className="toolbar"><div><span className="kicker">Active floor plan</span><h2>{floor.name}</h2></div><Badge>{activeMap ? `Version ${activeMap.version}` : 'Illustrative seed map'}</Badge></div><FloorMap floorName={floor.name} imageUrl={image} points={points.map(p => ({ ...p, label: p.name }))} robots={robots} selectedPoint={selectedPoint} onSelectPoint={setSelectedPoint} onMapClick={manage && placing ? (x, y) => { setEditing({ x, y, name: '', category: 'department' }); setPlacing(false) } : undefined} /><div className="toolbar"><span className="muted">{placing ? 'Click or tap the map to place a point.' : 'Drag to pan · use controls to zoom'}</span>{manage && <Button onClick={() => setPlacing(p => !p)}><Plus size={15} />{placing ? 'Cancel placement' : 'Add point on map'}</Button>}</div><p className="muted">{activeMap?.scale ? `Optional calibration: ${activeMap.scale} meters per 100 image units.` : 'Scale unknown. Coordinates are image percentages, not meters.'} Uploading a plan does not provide SLAM, localization, obstacle avoidance, elevator control, or docking.</p></Card>
      <div className="stack"><Card><span className="kicker">Points of interest</span><h2>Where to?</h2>{points.length ? points.map(p => <div className={`poi-row ${selectedPoint === p.id ? 'selected' : ''}`} key={p.id}><button onClick={() => setSelectedPoint(p.id)}><MapPin size={17} /><span><strong>{p.name}</strong><small>{p.category} · {p.x.toFixed(0)}%, {p.y.toFixed(0)}%</small></span></button>{manage && <div className="row"><Button variant="ghost" onClick={() => setEditing(p)}>Edit</Button><button className="icon-button" aria-label={`Delete ${p.name}`} onClick={() => setConfirmDelete({ id: p.id, action: 'point.delete', name: p.name })}><Trash2 size={15} /></button></div>}</div>) : <p className="muted">No points on this floor. Place the first one on the map.</p>}{manage && <Button onClick={() => setEditing({ name: '', category: 'department', x: 50, y: 50 })}><Plus size={15} /> Add point</Button>}</Card>
      <Card><span className="kicker">Demonstration mission</span><h2>Send a simulated journey</h2><form className="stack" onSubmit={e => { e.preventDefault(); if (!manageMissions) return; void act('mission.create', { organizationId: scopedOrgId, robotId: selectedRobot?.id, pointId: selectedPoint }) }}><Field label="Robot"><select required value={selectedRobot?.id ?? ''} onChange={e => setRobotId(e.target.value)}>{robots.map(r => <option key={r.id} value={r.id}>{r.name} · {r.connectivity}</option>)}</select></Field><Field label="Destination"><select required value={selectedPoint} onChange={e => setSelectedPoint(e.target.value)}><option value="">Select a point</option>{points.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Button type="submit" variant="primary" disabled={!manageMissions || !selectedRobot || !selectedPoint}><Flag size={16} /> Create mission</Button></form><p className="muted">Queued → running → completed. Demo missions do not issue hardware commands or certify a collision-free path.</p></Card></div>
    </div>}
    <div className="grid-2"><Card><div className="toolbar"><h2>Map versions</h2><span className="muted">PNG / JPEG / WebP · 5 MB max</span></div>{maps.length ? maps.slice().sort((a, b) => b.version - a.version).map(m => <div key={m.id} className="version-row"><MapVersionPreview name={m.name} blob={m.blob} /><div className="version-info"><strong>{m.name}</strong><small>v{m.version} · {new Date(m.createdAt).toLocaleDateString()} · {m.blob ? `${Math.ceil(m.blob.size / 1024)} KB stored locally` : 'Illustrative plan'}</small></div><Badge>{m.active ? 'Active' : 'Draft'}</Badge>{manage && <div className="row">{!m.active && <Button onClick={() => void act('map.activate', { id: m.id })}>Activate</Button>}<Button variant="ghost" onClick={() => setConfirmDelete({ id: m.id, action: 'map.delete', name: m.name })}>Delete</Button></div>}</div>) : <p className="muted">Upload a local image to create the first map version.</p>}{manage && activeMap && <form className="row" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act('map.update', { id: activeMap.id, scale: Number(data.get('scale')) }) }}><Field label="Optional meters per 100 image units"><input name="scale" type="number" min=".01" max="100000" step=".01" required defaultValue={activeMap.scale} /></Field><Button type="submit">Save scale</Button></form>}</Card><Card><h2>Mission history</h2>{missions.length ? missions.slice().reverse().slice(0, 12).map(m => <div className="mission-row" key={m.id}><div><strong>{db.robots.find(r => r.id === m.robotId)?.name} → {db.points.find(p => p.id === m.pointId)?.name ?? 'Removed point'}</strong><small>{new Date(m.createdAt).toLocaleTimeString()} · ETA {m.status === 'completed' ? 'Arrived (simulated)' : `${Math.max(0, Math.round(m.eta))}s`}</small></div><Badge>{m.status}</Badge>{manageMissions && ['queued', 'running', 'paused'].includes(m.status) && <div className="row"><button className="icon-button" aria-label={m.status !== 'running' ? 'Start / resume mission' : 'Pause mission'} onClick={() => void act(m.status !== 'running' ? 'mission.resume' : 'mission.pause', { id: m.id })}>{m.status !== 'running' ? <Play size={16} /> : <Pause size={16} />}</button><Button variant="ghost" onClick={() => void act('mission.cancel', { id: m.id })}>Cancel</Button></div>}</div>) : <p className="muted">Your first simulated journey will appear here.</p>}</Card></div>
    {editing && manage && <PointEditor point={editing} floorId={floor?.id ?? ''} organizationId={scopedOrgId} onClose={() => setEditing(undefined)} />}
    {confirmDelete && manage && <Modal title={`Delete ${confirmDelete.name}?`} onClose={() => setConfirmDelete(undefined)}><p>This removes the local demo record. Missions targeting a removed point are canceled.</p><Button variant="danger" onClick={() => { void act(confirmDelete.action, { id: confirmDelete.id }); setConfirmDelete(undefined) }}>Delete</Button></Modal>}
    {locationModal && manage && <Modal title="Branches & floors" onClose={() => setLocationModal(false)}><div className="stack">
      <p className="muted">Branches containing floors, and floors containing robots, maps, or points, cannot be deleted. Move or remove those dependencies first.</p>
      <h3>Existing branches</h3>
      {db.locations.filter(l => l.organizationId === scopedOrgId).map(l => <form key={l.id} className="stack location-editor" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act('location.update', { id: l.id, name: data.get('name'), address: data.get('address') }) }}>
        <div className="form-grid"><Field label="Branch name"><input name="name" required maxLength={80} defaultValue={l.name} /></Field><Field label="Demo address"><input name="address" maxLength={200} defaultValue={l.address} /></Field></div>
        <div className="row"><Button type="submit">Save branch</Button><Button variant="danger" onClick={() => { setLocationModal(false); setConfirmDelete({ id: l.id, action: 'location.delete', name: l.name }) }}>Delete branch</Button></div>
      </form>)}
      <h3>Existing floors</h3>
      {floors.map(f => <form key={f.id} className="row location-editor" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act('floor.update', { id: f.id, name: data.get('name') }) }}><Field label={db.locations.find(l => l.id === f.locationId)?.name ?? 'Floor'}><input name="name" required maxLength={80} defaultValue={f.name} /></Field><Button type="submit">Save floor</Button><Button variant="danger" onClick={() => { setLocationModal(false); setConfirmDelete({ id: f.id, action: 'floor.delete', name: f.name }) }}>Delete</Button></form>)}
      <h3>Create branch</h3>
      <form className="stack" onSubmit={e => { e.preventDefault(); void act('location.create', { organizationId: scopedOrgId, name: branchName, address: 'Demo branch' }).then(id => { if (id) { setBranchId(id); setBranchName('') } }) }}><Field label="New branch name"><input required maxLength={80} value={branchName} onChange={e => setBranchName(e.target.value)} /></Field><Button type="submit">Add branch</Button></form>
      <h3>Create floor</h3>
      <form className="stack" onSubmit={e => { e.preventDefault(); void act('floor.create', { organizationId: scopedOrgId, locationId: branchId, name: newFloor }).then(id => { if (id) { setFloorId(id); setNewFloor(''); setLocationModal(false) } }) }}><Field label="Branch"><select required value={branchId} onChange={e => setBranchId(e.target.value)}><option value="">Choose branch</option>{db.locations.filter(l => l.organizationId === scopedOrgId).map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></Field><Field label="New floor name"><input required maxLength={80} value={newFloor} onChange={e => setNewFloor(e.target.value)} /></Field><Button type="submit" variant="primary">Add floor</Button></form>
    </div></Modal>}
  </>
}

function MapVersionPreview({ name, blob }: { name: string; blob?: Blob }) {
  const image = useBlobUrl(blob)
  const [open, setOpen] = useState(false)
  return <><button type="button" className="map-version-preview" aria-label={`Preview ${name}`} onClick={() => setOpen(true)}>{image ? <img src={image} alt="" /> : <MapPin size={22} />}</button>{open && <Modal title={`Preview: ${name}`} onClose={() => setOpen(false)}>{image ? <img className="map-version-image" src={image} alt={`${name} local floor plan`} /> : <FloorMap floorName={name} route={false} />}<p className="muted">Local floor-plan preview. Activate this version to replace the current floor map.</p></Modal>}</>
}

function PointEditor({ point, floorId, organizationId, onClose }: { point: Partial<MapPoint>; floorId: string; organizationId: string; onClose: () => void }) {
  const { act } = useDemo()
  const [name, setName] = useState(point.name ?? '')
  const [category, setCategory] = useState(point.category ?? 'department')
  const [x, setX] = useState(point.x ?? 50)
  const [y, setY] = useState(point.y ?? 50)
  return <Modal title={point.id ? 'Edit point of interest' : 'Add point of interest'} onClose={onClose}><form className="stack" onSubmit={e => { e.preventDefault(); void act(point.id ? 'point.update' : 'point.create', { id: point.id, organizationId, floorId, name, category, x, y }).then(() => onClose()) }}><Field label="Location label"><input required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Category"><select value={category} onChange={e => setCategory(e.target.value)}>{['department', 'reception', 'help', 'elevator', 'charging', 'room', 'service'].map(c => <option key={c}>{c}</option>)}</select></Field><div className="form-grid"><Field label="X (% of image)"><input required type="number" min={0} max={100} step=".1" value={x} onChange={e => setX(Number(e.target.value))} /></Field><Field label="Y (% of image)"><input required type="number" min={0} max={100} step=".1" value={y} onChange={e => setY(Number(e.target.value))} /></Field></div><p className="muted">Points use image coordinates. They are not robot navigation goals in a calibrated world frame.</p><Button type="submit" variant="primary">Save point</Button></form></Modal>
}
