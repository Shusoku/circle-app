// Circle backend: REST for accounts and circles, a WebSocket for everything live.
// Serves the phone app at / and the virtual pendant at /pendant/.

import express from 'express';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Hub, HubError } from './hub.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..', '..');

export function startServer({ port = Number(process.env.PORT) || 8787, dataFile = process.env.CIRCLE_DATA || join(ROOT, 'server', 'data', 'circle.json'), quiet = false } = {}) {
  let saveTimer = null;
  const save = () => {
    if (!dataFile) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      mkdirSync(dirname(dataFile), { recursive: true });
      writeFileSync(dataFile + '.tmp', JSON.stringify(hub.toJSON()));
      renameSync(dataFile + '.tmp', dataFile);
    }, 300);
  };
  const hub = new Hub({ onChange: save });
  if (dataFile && existsSync(dataFile)) hub.load(JSON.parse(readFileSync(dataFile, 'utf8')));

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const auth = (req, res, next) => {
    try {
      const t = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
      req.who = hub.auth(t);
      next();
    } catch (e) { next(e); }
  };
  const wrap = (fn) => (req, res, next) => { try { res.json(fn(req) ?? { ok: true }); } catch (e) { next(e); } };

  app.get('/api/health', (req, res) => res.json({ ok: true, app: 'circle' }));
  app.post('/api/users', wrap((req) => hub.createUser(req.body?.name)));
  app.get('/api/me', auth, wrap((req) => hub.view(req.who.userId)));
  app.post('/api/circles', auth, wrap((req) => hub.createCircle(req.who.userId, req.body?.name)));
  app.post('/api/circles/join', auth, wrap((req) => hub.joinCircle(req.who.userId, req.body?.code)));
  app.put('/api/settings', auth, wrap((req) => hub.updateSettings(req.who.userId, req.body)));
  app.post('/api/blocks', auth, wrap((req) => hub.block(req.who.userId, req.body?.userId)));
  app.delete('/api/blocks/:id', auth, wrap((req) => hub.unblock(req.who.userId, req.params.id)));
  app.get('/api/friends/:id/address', auth, wrap((req) => hub.address(req.who.userId, req.params.id)));
  app.post('/api/devices/pair-code', auth, wrap((req) => hub.createPairCode(req.who.userId)));
  app.post('/api/devices/pair', wrap((req) => hub.pairDevice(req.body?.code)));

  // Static apps. Only these files are served, never the rest of the repo.
  app.get(['/', '/index.html'], (req, res) => res.sendFile(join(ROOT, 'index.html')));
  app.get('/live.js', (req, res) => res.sendFile(join(ROOT, 'live.js')));
  const pendantDist = join(ROOT, 'pendant', 'dist');
  app.use('/pendant', express.static(pendantDist));
  app.get('/pendant', (req, res) => res.redirect('/pendant/'));
  app.get('/pendant/*', (req, res) => existsSync(join(pendantDist, 'index.html'))
    ? res.sendFile(join(pendantDist, 'index.html'))
    : res.status(503).send('Build the pendant first: cd pendant && npm install && npm run build'));

  app.use((err, req, res, next) => {
    const status = err instanceof HubError ? err.status : err.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500 && !quiet) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
  });

  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

  // First message must be { type: 'auth', token }. After that, live actions.
  wss.on('connection', (ws) => {
    let who = null;
    let disconnect = () => {};
    const send = (msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
    const authTimer = setTimeout(() => { if (!who) ws.close(4001, 'auth timeout'); }, 5000);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return send({ type: 'error', error: 'Bad message' }); }
      try {
        if (!who) {
          if (msg.type !== 'auth') throw new HubError(401, 'Send auth first');
          who = hub.auth(msg.token);
          clearTimeout(authTimer);
          disconnect = hub.connect(who.userId, { send, kind: who.kind });
          return;
        }
        const id = who.userId;
        switch (msg.type) {
          case 'location': hub.setLocation(id, msg); break;
          case 'select': hub.select(id, msg.friendId); break;
          case 'dest': hub.setDest(id, msg.dest); break;
          case 'arrow': hub.setArrow(id, msg.on); break;
          case 'gesture': {
            const r = hub.gesture(id, msg.to, msg.kind);
            send({ type: 'gesture-result', kind: msg.kind, ...r });
            break;
          }
          case 'vitals': hub.setVitals(id, msg); break;
          case 'sos': hub.startAlert(id, msg.reason === 'fall_detected' ? 'fall_detected' : 'manual_sos'); break;
          case 'cancel': hub.cancelAlert(id); break;
          case 'dispatch': hub.dispatchNow(id); break;
          case 'safe': hub.markSafe(id); break;
          case 'ping': send({ type: 'pong' }); break;
          default: throw new HubError(400, 'Unknown message type');
        }
      } catch (e) {
        send({ type: 'error', error: e instanceof HubError ? e.message : 'Something went wrong', for: msg?.type });
        if (e instanceof HubError && e.status === 401) ws.close(4001, 'unauthorized');
      }
    });
    ws.on('close', () => { clearTimeout(authTimer); disconnect(); });
  });

  return new Promise((ok) => server.listen(port, () => {
    if (!quiet) console.log(`Circle is running.\n  Phone app: http://localhost:${server.address().port}/\n  Pendant:   http://localhost:${server.address().port}/pendant/`);
    ok({ server, hub, port: server.address().port, close: () => new Promise((done) => { wss.clients.forEach((c) => c.terminate()); wss.close(); server.close(done); }) });
  }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
