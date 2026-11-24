import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../src/server.js';
import { Hub } from '../src/hub.js';
import { offset } from '../src/geo.js';

const LAKE = { lat: 37.5485, lng: -121.9637 }; // Fremont, roughly Lake Elizabeth
let srv, base;

before(async () => { srv = await startServer({ port: 0, dataFile: null, quiet: true }); base = `http://localhost:${srv.port}`; });
after(() => srv.close());

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

// A live client that remembers the latest state and every event it saw.
function live(token) {
  return new Promise((ok, fail) => {
    const ws = new WebSocket(`ws://localhost:${srv.port}/ws`);
    const c = { ws, state: null, events: [], send: (m) => ws.send(JSON.stringify(m)) };
    c.until = (pred, ms = 2000) => new Promise((res, rej) => {
      const t0 = Date.now();
      const check = () => { const hit = pred(c); if (hit) return res(hit); if (Date.now() - t0 > ms) return rej(new Error('timed out')); setTimeout(check, 10); };
      check();
    });
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.type === 'state') c.state = m.state; else c.events.push(m); });
    ws.on('open', () => { c.send({ type: 'auth', token }); c.until((x) => x.state).then(() => ok(c), fail); });
    ws.on('error', fail);
  });
}

test('two friends find each other without exact coordinates', async () => {
  const a = await api('/api/users', { method: 'POST', body: { name: 'Josiah Allyn' } });
  const b = await api('/api/users', { method: 'POST', body: { name: 'Maya' } });
  assert.equal(a.status, 200);
  const circle = await api('/api/circles', { method: 'POST', token: a.body.token, body: { name: 'Track team' } });
  assert.match(circle.body.code, /^[A-Z2-9]{6}$/);
  const joined = await api('/api/circles/join', { method: 'POST', token: b.body.token, body: { code: circle.body.code.toLowerCase() } });
  assert.equal(joined.status, 200);

  const pa = await live(a.body.token);
  const pb = await live(b.body.token);
  assert.equal(pa.state.friends.length, 1);
  assert.equal(pa.state.friends[0].band, 'No location yet');

  pa.send({ type: 'location', ...LAKE });
  const mayaSpot = offset(LAKE, 0.6, 50);
  pb.send({ type: 'location', ...mayaSpot, area: 'Near Fremont BART' });
  const seen = await pa.until((c) => c.state.friends[0]?.miles != null && c.state.friends[0]);
  assert.equal(seen.name, 'Maya');
  assert.equal(seen.band, 'Under 1 mi');
  assert.equal(seen.area, 'Near Fremont BART');
  assert.equal(seen.bearing % 15, 0, 'bearing is rounded at this range');
  assert.equal(JSON.stringify(pa.state).includes(String(mayaSpot.lat)), false, 'exact coordinates never leak');

  pa.send({ type: 'select', friendId: seen.id });
  const target = await pa.until((c) => c.state.target);
  assert.equal(target.kind, 'friend');
  assert.equal(target.name, 'Maya');

  // Phone free walk overrides the friend target
  pa.send({ type: 'dest', dest: { name: 'Lake Elizabeth', ...offset(LAKE, 0.3, 200) } });
  const d = await pa.until((c) => c.state.target?.kind === 'dest' && c.state.target);
  assert.equal(d.name, 'Lake Elizabeth');
  assert.ok(Math.abs(d.bearing - 200) < 1);
  pa.send({ type: 'dest', dest: null });
  await pa.until((c) => c.state.target === null || c.state.target?.kind === 'friend');

  pa.ws.close(); pb.ws.close();
});

test('pendant pairs to the same account and its taps reach a friend', async () => {
  const a = await api('/api/users', { method: 'POST', body: { name: 'Leo' } });
  const b = await api('/api/users', { method: 'POST', body: { name: 'Priya' } });
  const c = await api('/api/circles', { method: 'POST', token: a.body.token, body: {} });
  await api('/api/circles/join', { method: 'POST', token: b.body.token, body: { code: c.body.code } });

  const pc = await api('/api/devices/pair-code', { method: 'POST', token: a.body.token });
  const paired = await api('/api/devices/pair', { method: 'POST', body: { code: pc.body.code } });
  assert.equal(paired.body.user.name, 'Leo');
  const reuse = await api('/api/devices/pair', { method: 'POST', body: { code: pc.body.code } });
  assert.equal(reuse.status, 400, 'pairing codes are single use');

  const pendant = await live(paired.body.token);
  const phoneB = await live(b.body.token);
  const priyaId = pendant.state.friends[0].id;
  pendant.send({ type: 'select', friendId: priyaId });
  await pendant.until((x) => x.state.selected === priyaId);

  pendant.send({ type: 'gesture', kind: 'double' });
  const got = await phoneB.until((x) => x.events.find((e) => e.type === 'ping'));
  assert.equal(got.message, 'Leo is thinking of you');

  pendant.send({ type: 'gesture', kind: 'triple' });
  await phoneB.until((x) => x.events.find((e) => e.kind === 'triple'));

  // Raid blocking: after 5 pings in a minute the rest are muted
  for (let i = 0; i < 6; i++) pendant.send({ type: 'gesture', kind: 'ping' });
  const muted = await pendant.until((x) => x.events.find((e) => e.type === 'gesture-result' && e.muted));
  assert.equal(muted.delivered, false);
  await phoneB.until((x) => x.events.find((e) => /Raid blocked/.test(e.message || '')));

  pendant.ws.close(); phoneB.ws.close();
});

test('blocking, addresses and settings', async () => {
  const a = await api('/api/users', { method: 'POST', body: { name: 'Andre' } });
  const b = await api('/api/users', { method: 'POST', body: { name: 'Jordan' } });
  const c = await api('/api/circles', { method: 'POST', token: a.body.token, body: {} });
  await api('/api/circles/join', { method: 'POST', token: b.body.token, body: { code: c.body.code } });
  const jordanId = (await api('/api/me', { token: a.body.token })).body.friends[0].id;
  const andreId = (await api('/api/me', { token: b.body.token })).body.friends[0].id;

  let addr = await api(`/api/friends/${jordanId}/address`, { token: a.body.token });
  assert.equal(addr.status, 403, 'no address until shared');
  await api('/api/settings', { method: 'PUT', token: b.body.token, body: { shareAddress: true, address: '123 Example St, Fremont' } });
  addr = await api(`/api/friends/${jordanId}/address`, { token: a.body.token });
  assert.equal(addr.body.address, '123 Example St, Fremont');

  await api('/api/blocks', { method: 'POST', token: a.body.token, body: { userId: jordanId } });
  assert.equal((await api('/api/me', { token: a.body.token })).body.friends.length, 0);
  assert.equal((await api('/api/me', { token: b.body.token })).body.friends.length, 0, 'blocking hides you both ways');
  assert.equal((await api(`/api/friends/${jordanId}/address`, { token: a.body.token })).status, 404);
  await api(`/api/blocks/${jordanId}`, { method: 'DELETE', token: a.body.token });
  assert.equal((await api('/api/me', { token: b.body.token })).body.friends[0].id, andreId);

  assert.equal((await api('/api/me')).status, 401);
  assert.equal((await api('/api/circles/join', { method: 'POST', token: a.body.token, body: { code: 'NOPE00' } })).status, 404);
});

test('hide me while at home', async () => {
  const a = await api('/api/users', { method: 'POST', body: { name: 'Sam' } });
  const b = await api('/api/users', { method: 'POST', body: { name: 'Kai' } });
  const c = await api('/api/circles', { method: 'POST', token: a.body.token, body: {} });
  await api('/api/circles/join', { method: 'POST', token: b.body.token, body: { code: c.body.code } });
  await api('/api/settings', { method: 'PUT', token: b.body.token, body: { hideHome: true, home: LAKE } });
  const pa = await live(a.body.token);
  const pb = await live(b.body.token);
  pa.send({ type: 'location', ...offset(LAKE, 2, 0) });
  pb.send({ type: 'location', ...LAKE });
  const f = await pa.until((x) => x.state.friends[0]?.band === 'At home' && x.state.friends[0]);
  assert.equal(f.bearing, null);
  pa.ws.close(); pb.ws.close();
});

test('unsafe alert: 10 second countdown, cancel, then friends get exact location', () => {
  let clock = 0;
  const timers = [];
  const hub = new Hub({ now: () => clock, setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer: () => { timers.length = 0; } });
  const a = hub.createUser('Ana');
  const b = hub.createUser('Ben');
  const aId = hub.auth(a.token).userId;
  const bId = hub.auth(b.token).userId;
  const circle = hub.createCircle(aId);
  hub.joinCircle(bId, circle.code);
  hub.setLocation(aId, LAKE);
  const benSaw = [];
  hub.connect(bId, { send: (m) => benSaw.push(m) });
  const run = (n) => { for (let i = 0; i < n; i++) { const fn = timers.shift(); clock += 1000; fn?.(); } };

  hub.startAlert(aId);
  run(4);
  assert.equal(hub.view(aId).emergency.countdown, 6);
  hub.cancelAlert(aId);
  assert.equal(hub.view(aId).emergency.state, 'idle');
  assert.equal(hub.view(bId).alerts.length, 0);

  // Vitals over the threshold start it automatically
  hub.setVitals(aId, { hr: 142, stress: 40 });
  assert.equal(hub.view(aId).emergency.reason, 'heart_rate_threshold');
  run(10);
  assert.equal(hub.view(aId).emergency.state, 'sent');
  const alert = hub.view(bId).alerts[0];
  assert.equal(alert.name, 'Ana');
  assert.equal(alert.location.lat, LAKE.lat, 'exact location is shared only during an alert');
  assert.ok(benSaw.some((m) => m.type === 'alert'));

  hub.markSafe(aId);
  assert.equal(hub.view(bId).alerts.length, 0);
  assert.ok(benSaw.some((m) => /safe now/.test(m.message || '')));
});

test('websocket rejects anything before auth', async () => {
  const ws = new WebSocket(`ws://localhost:${srv.port}/ws`);
  const closed = new Promise((ok) => ws.on('close', (code) => ok(code)));
  await new Promise((ok) => ws.on('open', ok));
  ws.send(JSON.stringify({ type: 'location', lat: 1, lng: 1 }));
  assert.equal(await closed, 4001);
});
