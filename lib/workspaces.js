'use strict';
const { ensure, text } = require('./domain');

const LEGACY = 'legacy';
const CATEGORIES = [
  { id: 'university', name: 'دانشگاه' },
  { id: 'hospital', name: 'بیمارستان' },
  { id: 'office', name: 'اداره' },
  { id: 'mall', name: 'مرکز خرید' },
  { id: 'museum', name: 'موزه' },
];

function emptyDirectory(name) {
  return { name, floors: [], nodes: [], edges: [], rooms: [], people: [] };
}

function initializeWorkspaces(data) {
  if (!Object.hasOwn(data, 'workspaces')) {
    data.workspaces = CATEGORIES.map(({ id, name }) => ({ id, name, category: id, directory: emptyDirectory(name) }));
    return true;
  }
  const ids = new Set();
  ensure(Array.isArray(data.workspaces) && data.workspaces.length === CATEGORIES.length, 'فهرست فضاهای کاری معتبر نیست.');
  for (const w of data.workspaces) {
    ensure(w && CATEGORIES.some(c => c.id === w.id) && !ids.has(w.id) && w.category === w.id && text(w.name) && w.name.trim() && w.directory, 'فضای کاری معتبر نیست.');
    ids.add(w.id);
  }
  return false;
}

function workspaceIdOf(robot) { return robot.workspaceId || LEGACY; }

function workspace(data, workspaceId = LEGACY) {
  ensure(workspaceId === LEGACY || CATEGORIES.some(c => c.id === workspaceId), 'شناسه فضای کاری معتبر نیست.');
  if (workspaceId === LEGACY) return { id: LEGACY, name: 'داده‌های قبلی', category: LEGACY, directory: data.directory };
  const result = data.workspaces.find(w => w.id === workspaceId);
  ensure(result, 'فضای کاری یافت نشد.', 404);
  return result;
}

function hasLegacy(data) {
  return ['floors', 'nodes', 'edges', 'rooms', 'people'].some(key => data.directory[key].length > 0) ||
    data.robots.some(r => workspaceIdOf(r) === LEGACY) || data.visits.some(v => (v.workspaceId || LEGACY) === LEGACY);
}

function summaries(data) {
  const list = data.workspaces.map(w => workspace(data, w.id));
  if (hasLegacy(data)) list.push(workspace(data, LEGACY));
  return list.map(w => {
    const robots = data.robots.filter(r => workspaceIdOf(r) === w.id);
    return {
      id: w.id, name: w.name, category: w.category,
      robotCount: robots.length, welcomeCount: robots.filter(r => r.mode === 'welcome').length,
      telepresenceCount: robots.filter(r => r.mode === 'telepresence').length,
      roomCount: w.directory.rooms.length, peopleCount: w.directory.people.length,
    };
  });
}

module.exports = { LEGACY, CATEGORIES, emptyDirectory, initializeWorkspaces, workspaceIdOf, workspace, summaries };
