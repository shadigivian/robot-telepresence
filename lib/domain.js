'use strict';

class Problem extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const ensure = (ok, message, status = 400) => { if (!ok) throw new Problem(status, message); };
const text = (v, max = 160) => typeof v === 'string' && v.length <= max && !/[\u0000-\u0008]/.test(v);
const id = v => typeof v === 'string' && /^[\w-]{1,64}$/.test(v);
const normalize = v => String(v || '').normalize('NFKC').toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\u200f]/g, ' ').replace(/\s+/g, ' ').trim();

function validateDirectory(d) {
  ensure(d && text(d.name) && d.name.trim(), 'نام مکان لازم است.');
  for (const key of ['floors', 'nodes', 'edges', 'rooms', 'people']) {
    ensure(Array.isArray(d[key]) && d[key].length <= 2000, `فهرست ${key} معتبر نیست.`);
    if (key !== 'edges') {
      const seen = new Set();
      for (const item of d[key]) {
        ensure(item && id(item.id) && !seen.has(item.id), `شناسه تکراری یا نامعتبر در ${key}.`);
        seen.add(item.id);
      }
    }
  }
  const floors = new Set(d.floors.map(f => f.id));
  const nodes = new Set(d.nodes.map(n => n.id));
  const rooms = new Set(d.rooms.map(r => r.id));
  for (const f of d.floors) ensure(text(f.name) && f.name.trim(), 'نام طبقه لازم است.');
  for (const n of d.nodes) ensure(floors.has(n.floorId) && text(n.name) && n.name.trim() && Number.isFinite(n.x) && Number.isFinite(n.y) && n.x >= 0 && n.x <= 100 && n.y >= 0 && n.y <= 100, 'گره نقشه یا مختصات آن معتبر نیست.');
  for (const e of d.edges) ensure(e && nodes.has(e.from) && nodes.has(e.to) && e.from !== e.to && Number.isFinite(e.distance) && e.distance > 0 && e.distance <= 10000 && text(e.instruction, 500) && text(e.reverseInstruction, 500) && typeof e.accessible === 'boolean' && typeof e.bidirectional === 'boolean', 'مسیر معتبر نیست؛ دستور مسیر رفت و برگشت را وارد کنید.');
  for (const r of d.rooms) ensure(nodes.has(r.nodeId) && text(r.name) && r.name.trim() && text(r.number, 40) && text(r.department) && text(r.hours) && typeof r.active === 'boolean' && Array.isArray(r.aliases) && r.aliases.length <= 30 && r.aliases.every(a => text(a)), 'اطلاعات اتاق معتبر نیست.');
  for (const p of d.people) ensure(rooms.has(p.roomId) && text(p.name) && p.name.trim() && text(p.title) && text(p.availability) && (!p.userId || id(p.userId)) && Array.isArray(p.aliases) && p.aliases.length <= 30 && p.aliases.every(a => text(a)) && typeof p.active === 'boolean', 'اطلاعات فرد معتبر نیست.');
  // Strip unknown fields: public directory never includes account or contact secrets.
  return {
    name: d.name.trim(),
    floors: d.floors.map(({ id, name }) => ({ id, name })),
    nodes: d.nodes.map(({ id, name, floorId, x, y }) => ({ id, name, floorId, x, y })),
    edges: d.edges.map(({ from, to, distance, instruction, reverseInstruction, accessible, bidirectional }) => ({ from, to, distance, instruction, reverseInstruction, accessible, bidirectional })),
    rooms: d.rooms.map(({ id, name, nodeId, number, department, hours, aliases, active }) => ({ id, name, nodeId, number, department, hours, aliases, active })),
    people: d.people.map(({ id, name, title, roomId, aliases, active, availability, userId }) => ({ id, name, title, roomId, aliases, active, availability, userId: userId || '' })),
  };
}
function publicDirectory(d) {
  return { ...d, people: d.people.map(({ userId, ...p }) => ({ ...p, canNotify: !!userId })) };
}
function searchDirectory(d, query) {
  const q = normalize(query).replace(/[؟?]/g, '').replace(/\b(where|is|the|room)\b/g, ' ').replace(/کجاست|کجاس|کجای|کجا|اتاق|میخواهم|می‌خواهم|دنبال/g, ' ').trim();
  const terms = q.split(/\s+/).filter(Boolean);
  const candidates = [
    ...d.rooms.filter(r => r.active).map(r => ({ ...r, kind: 'room', roomId: r.id, label: r.name, search: [r.name, r.number, r.department, ...r.aliases] })),
    ...d.people.filter(p => p.active && d.rooms.some(r => r.id === p.roomId && r.active)).map(p => ({ ...p, kind: 'person', label: p.name, search: [p.name, p.title, ...p.aliases] })),
  ];
  return candidates.map(c => ({ ...c, score: terms.length ? terms.filter(t => normalize(c.search.join(' ')).includes(t)).length / terms.length : 1 })).filter(c => c.score === 1).sort((a, b) => a.label.localeCompare(b.label, 'fa')).slice(0, 40).map(({ search, score, userId, ...c }) => c);
}
function planRoute(d, start, roomId, accessible = false) {
  const room = d.rooms.find(r => r.id === roomId && r.active);
  ensure(room && d.nodes.some(n => n.id === start), 'مبدأ یا مقصد معتبر نیست.', 404);
  const distances = new Map(d.nodes.map(n => [n.id, Infinity]));
  const previous = new Map();
  const remaining = new Set(distances.keys());
  distances.set(start, 0);
  while (remaining.size) {
    const current = [...remaining].reduce((a, b) => distances.get(a) <= distances.get(b) ? a : b);
    if (!Number.isFinite(distances.get(current))) break;
    remaining.delete(current);
    if (current === room.nodeId) break;
    for (const e of d.edges) {
      if (accessible && !e.accessible) continue;
      const next = e.from === current ? e.to : e.bidirectional && e.to === current ? e.from : null;
      if (!next || !remaining.has(next)) continue;
      const cost = distances.get(current) + e.distance;
      if (cost < distances.get(next)) {
        distances.set(next, cost);
        previous.set(next, { from: current, instruction: e.from === current ? e.instruction : e.reverseInstruction, distance: e.distance });
      }
    }
  }
  ensure(Number.isFinite(distances.get(room.nodeId)), 'برای این مقصد مسیر قابل استفاده ثبت نشده است.', 404);
  const nodes = [room.nodeId], steps = [];
  let current = room.nodeId;
  while (current !== start) {
    const edge = previous.get(current);
    steps.unshift({ from: edge.from, to: current, instruction: edge.instruction, distance: edge.distance });
    current = edge.from;
    nodes.unshift(current);
  }
  return { nodes, steps, distance: distances.get(room.nodeId), room };
}
module.exports = { Problem, ensure, text, id, normalize, validateDirectory, publicDirectory, searchDirectory, planRoute };
