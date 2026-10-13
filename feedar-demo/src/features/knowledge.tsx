import { useState } from 'react'
import { BookOpen, FileText, Plus, Search, Upload } from 'lucide-react'
import { useDemo } from '../app/context'
import { Badge, Button, Card, Empty, Field, Modal, PageTitle } from '../components/ui'
import type { KnowledgeSource } from '../domain/models'
import './fleet.css'

export function KnowledgePage() {
  const { db, organization, role, act, notify } = useDemo()
  const [orgId, setOrgId] = useState(organization?.id ?? db.organizations[0]?.id ?? '')
  const scopedOrgId = organization?.id ?? orgId
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<Partial<KnowledgeSource>>()
  const [archive, setArchive] = useState<KnowledgeSource>()
  const [page, setPage] = useState(1)
  const manage = ['BOSS', 'OWNER'].includes(role)
  const sources = db.knowledge.filter(k => k.organizationId === scopedOrgId && (status === 'all' || k.status === status) && `${k.title} ${k.text} ${k.category}`.toLowerCase().includes(query.toLowerCase()))
  const upload = async (file?: File) => {
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > 5 * 1024 * 1024 || file.size === 0) { notify('Use a demo PDF file up to 5 MB. Do not upload private documents.'); return }
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    if (String.fromCharCode(...signature) !== '%PDF-') { notify('The selected file is not a valid PDF document.'); return }
    await act('knowledge.create', { organizationId: scopedOrgId, title: file.name, text: '', category: 'file', status: 'draft', filename: file.name, blob: file, indexing: 'not_configured' })
    notify('PDF stored locally. Indexing is not configured; the assistant cannot read this file.')
  }
  return <>
    <PageTitle title="Knowledge & assistant" subtitle="Helpful answers start with approved public information." />
    <div className="toolbar"><div className="row">{!organization && <select value={orgId} aria-label="Knowledge organization" onChange={e => setOrgId(e.target.value)}>{db.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>}<Badge>Organization-scoped demo assistant</Badge></div>{manage && <div className="row"><label className="btn upload-button"><Upload size={16} /> Store demo PDF<input type="file" accept="application/pdf" onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} /></label><Button variant="primary" onClick={() => setEditing({ title: '', text: '', category: 'faq', status: 'draft' })}><Plus size={16} /> Add knowledge</Button></div>}</div>
    <div className="grid-3"><Card><span className="kicker">Approved answers</span><div className="knowledge-stat"><BookOpen size={28} /><strong>{db.knowledge.filter(k => k.organizationId === scopedOrgId && k.status === 'published' && !k.filename).length}</strong></div><p className="muted">Published text used by the local demo assistant.</p></Card><Card><span className="kicker">Review queue</span><div className="knowledge-stat"><FileText size={28} /><strong>{db.knowledge.filter(k => k.organizationId === scopedOrgId && k.status === 'draft').length}</strong></div><p className="muted">Drafts stay out of the public robot kiosk.</p></Card><Card><span className="kicker">File storage</span><h3>Local metadata only</h3><p className="muted">PDFs are stored in this browser. Parsing, embeddings, retrieval, and AI inference require future services.</p></Card></div>
    <Card><div className="toolbar"><h2>Knowledge library</h2><div className="row"><label className="search-field"><Search size={16} /><input aria-label="Search knowledge" placeholder="Search title or content…" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} /></label><select aria-label="Filter knowledge status" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}><option value="all">All statuses</option><option>draft</option><option>published</option><option>archived</option></select></div></div>{sources.length ? <div className="knowledge-grid">{sources.slice((page - 1) * 6, page * 6).map(k => <article className="knowledge-card" key={k.id}><div className="toolbar"><span className="knowledge-icon">{k.filename ? <FileText size={22} /> : <BookOpen size={22} />}</span><Badge>{k.status}</Badge></div><h3>{k.title}</h3><span className="kicker">{k.category}</span><p className="muted knowledge-excerpt">{k.filename ? `${k.filename} · ${Math.ceil((k.blob?.size ?? 0) / 1024)} KB. Stored locally; indexing not configured.` : k.text}</p><small className="muted">Updated {new Date(k.updatedAt).toLocaleDateString()} · revision {k.revision}</small>{manage && <div className="row"><Button onClick={() => setEditing(k)}>Edit</Button>{k.status !== 'published' && !k.filename && <Button variant="primary" onClick={() => void act('knowledge.publish', { id: k.id })}>Publish</Button>}{k.status !== 'archived' && <Button variant="ghost" onClick={() => setArchive(k)}>Archive</Button>}</div>}</article>)}</div> : <Empty title="No knowledge sources" text="Add public information about services, opening hours, policies, locations, and contacts." />}
      <div className="pagination"><span className="muted">{sources.length} sources · page {page}</span><Button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><Button disabled={page * 6 >= sources.length} onClick={() => setPage(p => p + 1)}>Next</Button></div></Card>
    <Card><h2>Public information policy</h2><p className="muted">Publish only fictitious information suitable for a public kiosk. The demo assistant cites matching text sources and admits missing information. It does not access draft, archived, or another organization's knowledge. File storage does not imply ingestion.</p></Card>
    {editing && <KnowledgeEditor source={editing} organizationId={scopedOrgId} onClose={() => setEditing(undefined)} />}
    {archive && <Modal title={`Archive “${archive.title}”?`} onClose={() => setArchive(undefined)}><p>Archived content will stop appearing in the public kiosk's demo assistant.</p><Button variant="danger" onClick={() => { void act('knowledge.archive', { id: archive.id }); setArchive(undefined) }}>Archive source</Button></Modal>}
  </>
}

function KnowledgeEditor({ source, organizationId, onClose }: { source: Partial<KnowledgeSource>; organizationId: string; onClose: () => void }) {
  const { act } = useDemo()
  const [title, setTitle] = useState(source.title ?? '')
  const [text, setText] = useState(source.text ?? '')
  const [category, setCategory] = useState(source.category ?? 'faq')
  return <Modal title={source.id ? 'Edit knowledge source' : 'Add public knowledge'} onClose={onClose}><form className="stack" onSubmit={e => { e.preventDefault(); void act(source.id ? 'knowledge.update' : 'knowledge.create', { id: source.id, organizationId, title, text, category, status: source.status ?? 'draft' }).then(() => onClose()) }}><Field label="Title / question"><input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></Field><Field label="Category"><select value={category} onChange={e => setCategory(e.target.value)}>{['faq', 'services', 'departments', 'locations', 'hours', 'policies', 'contacts', ...(source.filename ? ['file'] : [])].map(c => <option key={c}>{c}</option>)}</select></Field>{source.filename ? <p className="muted">File: {source.filename}. Stored locally; indexing not configured. Add a separate approved text source to teach the demo assistant.</p> : <Field label="Public answer / text"><textarea required maxLength={6000} rows={7} value={text} onChange={e => setText(e.target.value)} placeholder="Use fictitious, public demo information only." /></Field>}<p className="muted">Saved edits return to draft. Publish after review to make them visible to the public robot. No external AI service is called.</p><div className="modal-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save as draft</Button></div></form></Modal>
}
