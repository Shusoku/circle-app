// The Circle hub: everything the phone app and the pendant share.
// It knows nothing about HTTP or WebSockets, so it can be tested on its own.

import { randomBytes } from 'node:crypto';
import { band, bearing, blur, compassPoint, distanceMiles, toMeters } from './geo.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RAID_LIMIT = 5; // pings from one person in a minute before raid blocking kicks in
const ALERT_SECONDS = 10;
const HOME_RADIUS_MILES = 0.1;

export class HubError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const token = () => randomBytes(24).toString('base64url');
const code = (n = 6) => Array.from(randomBytes(n), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

function ago(ms) {
  const s = Math.round(ms / 1000);
  if (s < 45) return 'Live';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : 'Over a day ago';
}

export class Hub {
  constructor({ now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, onChange = () => {} } = {}) {
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onChange = onChange; // called after anything worth saving changes
    this.users = new Map();
    this.circles = new Map();
    this.tokens = new Map(); // token -> { userId, kind: 'phone' | 'pendant' }
    this.pairCodes = new Map(); // code -> { userId, expires }
    this.connections = new Map(); // userId -> Set of { send, kind }
    this.pingLog = new Map(); // `${from}>${to}` -> timestamps
    this.alertTimers = new Map();
  }

  /* ---------- persistence ---------- */
  toJSON() {
    return {
      users: [...this.users.values()].map((u) => ({ ...u, emergency: u.emergency.state === 'pending' ? { state: 'idle' } : u.emergency })),
      circles: [...this.circles.values()],
      tokens: [...this.tokens.entries()],
    };
  }
  load(data) {
    if (!data) return;
    for (const u of data.users || []) this.users.set(u.id, u);
    for (const c of data.circles || []) this.circles.set(c.id, c);
    for (const [t, v] of data.tokens || []) this.tokens.set(t, v);
  }

  /* ---------- accounts ---------- */
  createUser(name) {
    const clean = String(name || '').trim().slice(0, 40);
    if (!clean) throw new HubError(400, 'Name is required');
    const id = 'u_' + code(10).toLowerCase();
    const user = {
      id, name: clean, circles: [], blocked: [], loc: null, selected: null, dest: null, arrow: true,
      settings: { raidBlock: true, hideHome: false, shareAddress: false, address: '', autoAlert: true, home: null },
      vitals: null, emergency: { state: 'idle' }, createdAt: this.now(),
    };
    this.users.set(id, user);
    const t = token();
    this.tokens.set(t, { userId: id, kind: 'phone' });
    this.onChange();
    return { user: this.publicMe(user), token: t };
  }

  auth(t) {
    const hit = t && this.tokens.get(t);
    if (!hit || !this.users.has(hit.userId)) throw new HubError(401, 'Not signed in');
    return hit;
  }

  user(id) {
    const u = this.users.get(id);
    if (!u) throw new HubError(404, 'No such user');
    return u;
  }

  /* ---------- wearable pairing ---------- */
  createPairCode(userId) {
    this.user(userId);
    const c = code(6);
    this.pairCodes.set(c, { userId, expires: this.now() + 10 * 60 * 1000 });
    return { code: c, expiresInSeconds: 600 };
  }
  pairDevice(c) {
    const key = String(c || '').toUpperCase().replace(/\s/g, '');
    const hit = this.pairCodes.get(key);
    if (!hit || hit.expires < this.now()) throw new HubError(400, 'That pairing code is wrong or expired');
    this.pairCodes.delete(key);
    const t = token();
    this.tokens.set(t, { userId: hit.userId, kind: 'pendant' });
    this.onChange();
    this.push([hit.userId], { type: 'toast', message: 'Your wearable is paired' });
    return { token: t, user: this.publicMe(this.user(hit.userId)) };
  }

  /* ---------- circles ---------- */
  createCircle(userId, name) {
    const u = this.user(userId);
    const id = 'c_' + code(8).toLowerCase();
    let c;
    do c = code(6); while ([...this.circles.values()].some((x) => x.code === c));
    const circle = { id, name: String(name || `${u.name}'s circle`).slice(0, 40), code: c, members: [userId] };
    this.circles.set(id, circle);
    u.circles.push(id);
    this.onChange();
    this.broadcast([userId]);
    return circle;
  }

  joinCircle(userId, c) {
    const u = this.user(userId);
    const key = String(c || '').toUpperCase().replace(/\s/g, '');
    const circle = [...this.circles.values()].find((x) => x.code === key);
    if (!circle) throw new HubError(404, 'No circle has that code');
    if (!circle.members.includes(userId)) {
      circle.members.push(userId);
      u.circles.push(circle.id);
      this.onChange();
    }
    this.push(circle.members.filter((m) => m !== userId), { type: 'toast', message: `${u.name} joined ${circle.name}` });
    this.broadcast(circle.members);
    return circle;
  }

  // People who share a circle with you, minus anyone either of you blocked.
  friendIds(userId) {
    const u = this.user(userId);
    const ids = new Set();
    for (const cid of u.circles) for (const m of this.circles.get(cid)?.members || []) if (m !== userId) ids.add(m);
    return [...ids].filter((id) => !u.blocked.includes(id) && !this.user(id).blocked.includes(userId));
  }
  // Everyone who should hear about a change to this user.
  audience(userId) { return [userId, ...this.friendIds(userId)]; }
  isFriend(a, b) { return this.friendIds(a).includes(b); }

  /* ---------- blocking and settings ---------- */
  block(userId, otherId) {
    const u = this.user(userId);
    this.user(otherId);
    const before = this.audience(userId);
    if (!u.blocked.includes(otherId)) u.blocked.push(otherId);
    if (u.selected === otherId) u.selected = null;
    const other = this.user(otherId);
    if (other.selected === userId) other.selected = null;
    this.onChange();
    this.broadcast([...new Set([...before, otherId])]);
  }
  unblock(userId, otherId) {
    const u = this.user(userId);
    u.blocked = u.blocked.filter((x) => x !== otherId);
    this.onChange();
    this.broadcast([...this.audience(userId), otherId]);
  }

  updateSettings(userId, patch = {}) {
    const s = this.user(userId).settings;
    for (const k of ['raidBlock', 'hideHome', 'shareAddress', 'autoAlert']) if (k in patch) s[k] = !!patch[k];
    if ('address' in patch) s.address = String(patch.address || '').slice(0, 200);
    if ('home' in patch) s.home = validPoint(patch.home) ? { lat: +patch.home.lat, lng: +patch.home.lng } : null;
    this.onChange();
    this.broadcast(this.audience(userId));
    return s;
  }

  // The "hold for address" reveal. Only works if the friend chose to share it.
  address(userId, friendId) {
    if (!this.isFriend(userId, friendId)) throw new HubError(404, 'Not in your circle');
    const f = this.user(friendId);
    if (!f.settings.shareAddress || !f.settings.address) throw new HubError(403, `${f.name} hasn't shared an address`);
    return { name: f.name, address: f.settings.address };
  }

  /* ---------- location and pointing ---------- */
  setLocation(userId, p) {
    if (!validPoint(p)) throw new HubError(400, 'Location needs lat and lng');
    const u = this.user(userId);
    u.loc = { lat: +p.lat, lng: +p.lng, area: p.area ? String(p.area).slice(0, 60) : null, at: this.now() };
    this.broadcast(this.audience(userId));
  }

  select(userId, friendId) {
    const u = this.user(userId);
    if (friendId && !this.isFriend(userId, friendId)) throw new HubError(404, 'Not in your circle');
    u.selected = friendId || null;
    u.dest = null;
    this.broadcast([userId]);
  }

  // Phone free walk: the destination is saved to the account, so the wearable
  // can guide you there without the phone.
  setDest(userId, dest) {
    const u = this.user(userId);
    if (dest && !validPoint(dest)) throw new HubError(400, 'Destination needs lat and lng');
    u.dest = dest ? { name: String(dest.name || 'Destination').slice(0, 40), lat: +dest.lat, lng: +dest.lng } : null;
    this.broadcast([userId]);
  }

  setArrow(userId, on) {
    this.user(userId).arrow = !!on;
    this.broadcast([userId]);
  }

  /* ---------- taps and pings ---------- */
  // kind: 'double' (thinking of you), 'triple' (call me) or 'ping' (looking for you)
  gesture(fromId, toId, kind) {
    const from = this.user(fromId);
    const to = toId || from.selected;
    if (!to) throw new HubError(400, 'Pick a friend first');
    if (!this.isFriend(fromId, to)) throw new HubError(404, 'Not in your circle');
    if (!['double', 'triple', 'ping'].includes(kind)) throw new HubError(400, 'Unknown gesture');
    const key = `${fromId}>${to}`;
    const t = this.now();
    const recent = (this.pingLog.get(key) || []).filter((x) => t - x < 60_000);
    recent.push(t);
    this.pingLog.set(key, recent);
    const target = this.user(to);
    if (recent.length > RAID_LIMIT && target.settings.raidBlock) {
      if (recent.length === RAID_LIMIT + 1) this.push([to], { type: 'toast', message: `Raid blocked: muted pings from ${from.name} for a minute` });
      return { delivered: false, muted: true };
    }
    const text = { double: `${from.name} is thinking of you`, triple: `${from.name} asked you to call`, ping: `${from.name} is looking for you` }[kind];
    this.push([to], { type: 'ping', from: fromId, name: from.name, kind, message: text });
    return { delivered: true, muted: false };
  }

  /* ---------- safety ---------- */
  setVitals(userId, v = {}) {
    const u = this.user(userId);
    const num = (x, lo, hi) => (Number.isFinite(+x) ? Math.max(lo, Math.min(hi, +x)) : null);
    u.vitals = { hr: num(v.hr, 20, 250), stress: num(v.stress, 0, 100), spo2: num(v.spo2, 50, 100), motion: v.motion === 'fall' ? 'fall' : 'normal', at: this.now() };
    if (u.settings.autoAlert && u.emergency.state === 'idle') {
      const reason = u.vitals.motion === 'fall' ? 'fall_detected' : u.vitals.hr > 130 ? 'heart_rate_threshold' : u.vitals.stress > 80 ? 'stress_threshold' : null;
      if (reason) return this.startAlert(userId, reason);
    }
    this.broadcast([userId]);
  }

  startAlert(userId, reason = 'manual_sos') {
    const u = this.user(userId);
    if (u.emergency.state !== 'idle') return;
    u.emergency = { state: 'pending', reason, countdown: ALERT_SECONDS, startedAt: this.now() };
    const tick = () => {
      if (u.emergency.state !== 'pending') return;
      u.emergency.countdown -= 1;
      if (u.emergency.countdown <= 0) return this.sendAlert(userId);
      this.broadcast([userId]);
      this.alertTimers.set(userId, this.setTimer(tick, 1000));
    };
    this.alertTimers.set(userId, this.setTimer(tick, 1000));
    this.broadcast([userId]);
  }

  sendAlert(userId) {
    const u = this.user(userId);
    u.emergency = { ...u.emergency, state: 'sent', countdown: 0, sentAt: this.now() };
    this.onChange();
    // Friends get the exact location and vitals only now, during an alert.
    this.push(this.friendIds(userId), { type: 'alert', from: userId, name: u.name, message: `${u.name} sent an "I feel unsafe" alert` });
    this.broadcast(this.audience(userId));
  }

  // "Send now" during the countdown: skip the rest of the wait.
  dispatchNow(userId) {
    const u = this.user(userId);
    if (u.emergency.state !== 'pending') return;
    this.clearTimer(this.alertTimers.get(userId));
    this.sendAlert(userId);
  }

  cancelAlert(userId) {
    const u = this.user(userId);
    if (u.emergency.state !== 'pending') return;
    this.clearTimer(this.alertTimers.get(userId));
    u.emergency = { state: 'idle' };
    this.broadcast([userId]);
  }

  markSafe(userId) {
    const u = this.user(userId);
    this.clearTimer(this.alertTimers.get(userId));
    const wasSent = u.emergency.state === 'sent';
    u.emergency = { state: 'idle' };
    this.onChange();
    if (wasSent) this.push(this.friendIds(userId), { type: 'toast', message: `${u.name} is safe now` });
    this.broadcast(this.audience(userId));
  }

  /* ---------- what each person sees ---------- */
  publicMe(u) {
    return {
      id: u.id, name: u.name, settings: u.settings, blocked: u.blocked.map((id) => ({ id, name: this.users.get(id)?.name || 'Someone' })),
      circles: u.circles.map((cid) => this.circles.get(cid)).filter(Boolean).map((c) => ({ id: c.id, name: c.name, code: c.code, size: c.members.length })),
      hasLocation: !!u.loc,
    };
  }

  // How a friend looks from where I stand. Never their exact coordinates.
  friendView(me, f) {
    const base = { id: f.id, name: f.name, initials: initials(f.name), last: f.loc ? ago(this.now() - f.loc.at) : 'No location yet' };
    const atHome = f.settings.hideHome && f.loc && f.settings.home && distanceMiles(f.loc, f.settings.home) < HOME_RADIUS_MILES;
    if (atHome) return { ...base, band: 'At home', area: 'Home', miles: null, meters: null, bearing: null };
    if (!f.loc || !me.loc) return { ...base, band: f.loc ? 'Share your location to see' : 'No location yet', area: f.loc?.area || '', miles: null, meters: null, bearing: null };
    const b = blur(distanceMiles(me.loc, f.loc), bearing(me.loc, f.loc));
    return { ...base, band: band(b.miles), area: f.loc.area || `${band(b.miles)} ${compassPoint(b.bearing)} of you`, miles: b.miles, meters: toMeters(b.miles), bearing: b.bearing };
  }

  view(userId) {
    const u = this.user(userId);
    const friends = this.friendIds(userId).map((id) => this.friendView(u, this.user(id)));
    let target = null;
    if (u.dest && u.loc) {
      const miles = distanceMiles(u.loc, u.dest);
      target = { kind: 'dest', id: 'dest', name: u.dest.name, miles, meters: toMeters(miles), bearing: bearing(u.loc, u.dest), band: band(miles) };
    } else if (u.selected) {
      const f = friends.find((x) => x.id === u.selected);
      if (f) target = { kind: 'friend', id: f.id, name: f.name, miles: f.miles, meters: f.meters, bearing: f.bearing, band: f.band };
    }
    const alerts = this.friendIds(userId).map((id) => this.user(id)).filter((f) => f.emergency.state === 'sent')
      .map((f) => ({ id: f.id, name: f.name, location: f.loc && { lat: f.loc.lat, lng: f.loc.lng, area: f.loc.area }, vitals: f.vitals, reason: f.emergency.reason, sentAt: f.emergency.sentAt }));
    return { me: this.publicMe(u), friends, selected: u.selected, dest: u.dest, arrow: u.arrow, target, vitals: u.vitals, emergency: u.emergency, alerts };
  }

  /* ---------- live connections ---------- */
  connect(userId, conn) {
    if (!this.connections.has(userId)) this.connections.set(userId, new Set());
    this.connections.get(userId).add(conn);
    conn.send({ type: 'state', state: this.view(userId) });
    return () => this.connections.get(userId)?.delete(conn);
  }
  push(userIds, msg) {
    for (const id of userIds) for (const c of this.connections.get(id) || []) c.send(msg);
  }
  broadcast(userIds) {
    for (const id of new Set(userIds)) {
      const set = this.connections.get(id);
      if (!set || !set.size || !this.users.has(id)) continue;
      const msg = { type: 'state', state: this.view(id) };
      for (const c of set) c.send(msg);
    }
  }
}

function validPoint(p) {
  return p && Number.isFinite(+p.lat) && Number.isFinite(+p.lng) && Math.abs(+p.lat) <= 90 && Math.abs(+p.lng) <= 180;
}
