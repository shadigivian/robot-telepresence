import { useRef, useState } from 'react'
import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'

export interface FloorMapPoint { id: string; label: string; x: number; y: number; category?: string }
export interface FloorMapRobot { id: string; name: string; x: number; y: number; heading: number }
export interface FloorMapProps {
  points?: FloorMapPoint[]
  robots?: FloorMapRobot[]
  imageUrl?: string
  selectedPoint?: string
  onSelectPoint?: (id: string) => void
  onMapClick?: (x: number, y: number) => void
  compact?: boolean
  route?: boolean
  floorName?: string
}

/** Coordinates are percentages of the floor image; they do not imply localization. */
export function FloorMap({ points = [], robots = [], imageUrl, selectedPoint, onSelectPoint, onMapClick, compact, route = true, floorName = 'Ground floor' }: FloorMapProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const gesture = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  return <div className={`floor-map ${compact ? 'compact' : ''}`}>
    <div className="map-caption"><span><i className="status-dot" />{floorName}</span><span>Simulated position · image % coordinates</span></div>
    <div ref={viewport} className="map-viewport" aria-label={`${floorName} demonstration floor map`} onPointerDown={event => {
      if ((event.target as HTMLElement).closest('button')) return
      event.currentTarget.setPointerCapture(event.pointerId)
      gesture.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y, moved: false }
    }} onPointerMove={event => {
      if (!gesture.current) return
      const dx = event.clientX - gesture.current.x, dy = event.clientY - gesture.current.y
      if (Math.abs(dx) + Math.abs(dy) > 5) gesture.current.moved = true
      if (gesture.current.moved) setPan({ x: gesture.current.px + dx, y: gesture.current.py + dy })
    }} onPointerUp={event => {
      const start = gesture.current
      gesture.current = null
      if (!start?.moved && onMapClick && viewport.current) {
        const rect = viewport.current.getBoundingClientRect()
        const x = ((event.clientX - rect.left - rect.width / 2 - pan.x) / zoom + rect.width / 2) / rect.width * 100
        const y = ((event.clientY - rect.top - rect.height / 2 - pan.y) / zoom + rect.height / 2) / rect.height * 100
        onMapClick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)))
      }
    }} onPointerCancel={() => { gesture.current = null }}>
      <div className="map-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {imageUrl ? <img className="map-image" src={imageUrl} alt={`${floorName} uploaded floor plan`} /> : <svg className="map-plan" viewBox="0 0 800 500" role="img" aria-label="Illustrative floor plan">
          <defs><pattern id="map-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#284462" strokeWidth=".5" /></pattern></defs>
          <rect width="800" height="500" fill="#0a1929" /><rect width="800" height="500" fill="url(#map-grid)" />
          <path d="M70 65H735V435H70Z M70 210H735 M70 310H735 M280 65V210 M520 65V210 M210 310V435 M440 310V435 M650 310V435" fill="none" stroke="#4b6580" strokeWidth="8" />
          <path d="M185 210h55 M355 210h55 M555 210h55 M270 310h55 M515 310h55" stroke="#0a1929" strokeWidth="11" />
          <rect x="90" y="85" width="168" height="100" rx="10" fill="#132e43" /><rect x="300" y="85" width="195" height="100" rx="10" fill="#132e43" /><rect x="540" y="85" width="175" height="100" rx="10" fill="#132e43" />
          <rect x="90" y="335" width="100" height="75" rx="9" fill="#163649" /><rect x="235" y="335" width="180" height="75" rx="9" fill="#132e43" /><rect x="465" y="335" width="160" height="75" rx="9" fill="#132e43" /><rect x="675" y="335" width="40" height="75" rx="8" fill="#163649" />
          <text x="370" y="275" fill="#52708d" fontSize="17" fontFamily="system-ui" letterSpacing="3">MAIN CORRIDOR</text>
        </svg>}
        {route && <svg className="map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={`M ${robots[0]?.x ?? 18} ${robots[0]?.y ?? 53} L 36 53 L 36 28 L ${points.find(p => p.id === selectedPoint)?.x ?? 70} ${points.find(p => p.id === selectedPoint)?.y ?? 28}`} fill="none" stroke="#6ce5d8" strokeWidth=".55" strokeDasharray="1.6 1.4" /></svg>}
        {points.map(point => <button key={point.id} type="button" className={`map-point ${point.id === selectedPoint ? 'selected' : ''}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onClick={() => onSelectPoint?.(point.id)} title={`${point.label} · ${point.category ?? 'location'}`}><span className="point-pin" /><span>{point.label}</span></button>)}
        {robots.map(robot => <div key={robot.id} className="map-robot" style={{ left: `${robot.x}%`, top: `${robot.y}%` }} title={`${robot.name} · simulated heading ${Math.round(robot.heading * 180 / Math.PI)}°`}><span style={{ transform: `rotate(${robot.heading * 180 / Math.PI + 90}deg)` }}>↑</span><small>{robot.name}</small></div>)}
      </div>
    </div>
    <div className="map-controls"><button aria-label="Zoom in" type="button" onClick={() => setZoom(z => Math.min(3, z + .25))}><Plus size={17} /></button><button aria-label="Zoom out" type="button" onClick={() => setZoom(z => Math.max(.75, z - .25))}><Minus size={17} /></button><button aria-label="Reset map view" type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}><RotateCcw size={16} /></button><span>{Math.round(zoom * 100)}%</span><Maximize2 size={15} /></div>
    <p className="map-disclaimer">Illustrative route. Scale unknown; this is not validated real-world navigation.</p>
  </div>
}
