// Circle live mode. When the phone app is served by the Circle server, this
// swaps the demo data for real friends, real taps and real alerts.
// Opened anywhere else (a file, a Claude artifact) it does nothing.
(function () {
  var App = window.CircleApp;
  if (!App || !/^https?:$/.test(location.protocol)) return;
  var S = App.S;
  var token = store('circle.token');
  var ws = null, retry = 0, me = null, myLoc = null, gpsWatch = null, simulated = false;
  var lastAlertIds = '', pending = false;
  var DOTS = ['#F2B33D', '#7DB4FF', '#B9A4FF', '#6FD3B5', '#FF9E7A', '#9EE07A', '#FFD27A'];
  var PLACES = [ // phone free walk presets, placed around wherever you are
    { id: 'lake', name: 'Lake Elizabeth', miles: 0.6, deg: 340 },
    { id: 'bart', name: 'Fremont BART', miles: 1.1, deg: 55 },
    { id: 'sfbu', name: 'SFBU campus', miles: 2.0, deg: 120 },
    { id: 'home', name: 'Home', miles: 1.4, deg: 220 }
  ];

  fetch('/api/health').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (j && j.app === 'circle') start();
  }).catch(function () {});

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function api(path, method, body) {
    return fetch(path, {
      method: method || 'GET',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Request failed'); return j; });
    });
  }
  function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
  function color(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return DOTS[h % DOTS.length]; }

  /* ---------- sign in ---------- */
  function start() {
    S.live = true;
    S.requests = [];
    S.v2k = 'Stress'; S.v2u = '% stress'; S.hr = '--'; S.spo2 = '--';
    if (token) return connect();
    var app = document.querySelector('.app');
    var box = document.createElement('div');
    box.className = 'overlay';
    box.innerHTML = '<form><div class="h2">Welcome to Circle</div><div class="sub">Pick the name your friends will see.</div>' +
      '<label class="label" for="liveName">Your name</label><input id="liveName" autocomplete="nickname" maxlength="40" required>' +
      '<button class="btn gold" style="min-height:48px">Continue</button></form>';
    app.appendChild(box);
    box.querySelector('input').focus();
    box.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = box.querySelector('input').value.trim();
      if (!name) return;
      fetch('/api/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.token) throw new Error(j.error || 'Could not sign up');
          token = j.token; store('circle.token', token);
          box.remove();
          App.say('Hi ' + name + '. Share your code or join a friend’s on the Circle tab.');
          App.goTab('circle');
          connect();
        })
        .catch(function (err) { App.say(err.message); });
    });
  }

  /* ---------- live connection ---------- */
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = function () { retry = 0; send({ type: 'auth', token: token }); startLocation(); };
    ws.onmessage = function (ev) {
      var m = JSON.parse(ev.data);
      if (m.type === 'state') return apply(m.state);
      if (m.type === 'ping' || m.type === 'toast') { App.say(m.message); buzz(m.kind === 'triple' ? [80, 60, 80, 60, 80] : [80, 60, 80]); }
      if (m.type === 'alert') { App.say(m.message); buzz([400, 150, 400]); }
      if (m.type === 'gesture-result' && m.muted) App.say('Their raid blocking muted that ping. Try again in a minute.');
      if (m.type === 'error') App.say(m.error);
    };
    ws.onclose = function (ev) {
      if (ev.code === 4001) { store('circle.token', null); token = null; return start(); }
      setTimeout(connect, Math.min(10000, 500 * Math.pow(2, retry++)));
    };
  }
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  function apply(st) {
    me = st.me;
    S.myCode = me.circles.length ? me.circles[0].code : '';
    var old = {};
    S.friends.forEach(function (f) { old[f.id] = f; });
    S.friends = st.friends.map(function (f) {
      var o = old[f.id] || {};
      return {
        id: f.id, name: f.name, area: f.area || f.band, band: f.band, last: f.last, dot: color(f.id), blocked: false,
        dist: f.miles == null ? 99 : f.miles, home: f.miles == null ? 99 : f.miles, bearing: f.bearing == null ? 0 : f.bearing,
        address: o.address, addressNote: o.addressNote
      };
    }).concat(me.blocked.map(function (b) { return { id: b.id, name: b.name, blocked: true, dist: 99, bearing: 0, area: '', last: '' }; }));
    S.selected = st.selected;
    // Point at someone by default so the phone and the pendant agree from the start.
    if (!st.selected && !st.dest && st.friends.length) send({ type: 'select', friendId: st.friends[0].id });
    S.raidBlock = me.settings.raidBlock; S.hideHome = me.settings.hideHome; S.autoAlert = me.settings.autoAlert;

    // Phone free walk presets sit around your current spot
    S.dests = PLACES.map(function (p) {
      var d = { id: p.id, name: p.name, dist: p.miles, home: p.miles, bearing: p.deg };
      if (st.target && st.target.kind === 'dest' && st.target.name === p.name) { d.dist = st.target.miles; d.bearing = st.target.bearing; }
      return d;
    });
    var walking = st.dest && S.dests.find(function (d) { return d.name === st.dest.name; });
    S.dest = walking ? walking.id : null;

    var v = st.vitals;
    S.hr = v && v.hr != null ? v.hr : '--';
    S.spo2 = v && v.stress != null ? v.stress : '--';
    S.motion = v && v.motion === 'fall' ? 'Fall!' : 'Normal';

    var e = st.emergency;
    if (e.state === 'pending') { if (S.unsafe !== 'active') S.tab = 'safety'; S.unsafe = 'active'; S.cancelLeft = e.countdown; }
    else if (e.state === 'sent') S.unsafe = 'sent';
    else if (S.unsafe !== 'arming') S.unsafe = 'idle';

    S.friendAlerts = st.alerts.map(function (a) {
      return { name: a.name, where: a.location ? (a.location.area || 'Exact spot: ' + a.location.lat.toFixed(5) + ', ' + a.location.lng.toFixed(5)) : 'Location unknown', hr: a.vitals && a.vitals.hr };
    });
    var ids = st.alerts.map(function (a) { return a.id; }).join(',');
    if (ids && ids !== lastAlertIds) S.tab = 'safety';
    lastAlertIds = ids;

    var chip = document.getElementById('chip');
    safeRender();
    if (chip) chip.textContent = S.dest ? 'Phone free walk' : simulated ? 'Live · simulated GPS' : 'Live · area only';
  }

  // Don't redraw under someone's thumb: typing a code or holding a button.
  function safeRender() {
    var active = document.activeElement;
    if (S.unsafe === 'arming' || (active && (active.id === 'code' || active.id === 'liveName'))) {
      if (!pending) { pending = true; setTimeout(function () { pending = false; safeRender(); }, 600); }
      return;
    }
    App.render();
  }

  /* ---------- location ---------- */
  function startLocation() {
    if (gpsWatch !== null || simulated) return sendLoc();
    if (!navigator.geolocation) return simulate();
    gpsWatch = navigator.geolocation.watchPosition(function (p) {
      if (simulated) return;
      myLoc = { lat: p.coords.latitude, lng: p.coords.longitude };
      sendLoc();
    }, simulate, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }
  function simulate() {
    if (simulated) return;
    simulated = true;
    var saved = store('circle.simLoc');
    myLoc = saved ? JSON.parse(saved) : { lat: 37.5485 + (Math.random() - 0.5) * 0.03, lng: -121.9637 + (Math.random() - 0.5) * 0.03 };
    store('circle.simLoc', JSON.stringify(myLoc));
    App.say('No GPS here, so Circle is using a simulated spot in Fremont');
    sendLoc();
  }
  function sendLoc() { if (myLoc) send({ type: 'location', lat: myLoc.lat, lng: myLoc.lng }); }

  function offset(o, miles, deg) {
    var R = 3958.8, d = miles / R, b = deg * Math.PI / 180, la = o.lat * Math.PI / 180, lo = o.lng * Math.PI / 180;
    var la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    var lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return { lat: la2 * 180 / Math.PI, lng: lo2 * 180 / Math.PI };
  }

  /* ---------- hooks the app calls ---------- */
  window.CircleLive = {
    select: function (id) { if (S.live) send({ type: 'select', friendId: id }); },
    reveal: function (id) {
      if (!S.live) return;
      var f = S.friends.find(function (x) { return x.id === id; });
      if (!f || f.address || f.addressNote) return;
      api('/api/friends/' + encodeURIComponent(id) + '/address')
        .then(function (j) { f.address = j.address; })
        .catch(function (err) { f.addressNote = err.message; })
        .then(App.render);
    },
    gesture: function (kind) { if (S.live) send({ type: 'gesture', kind: kind }); },
    settings: function (patch) {
      if (!S.live) return;
      if (patch.hideHome && !me.settings.home && myLoc) { patch.home = myLoc; App.say('Home is set to where you are now'); }
      api('/api/settings', 'PUT', patch).catch(function (err) { App.say(err.message); });
    },
    join: function (code) {
      if (!S.live) return false;
      api('/api/circles/join', 'POST', { code: code }).then(function (c) { App.say('You joined ' + c.name); }).catch(function (err) { App.say(err.message); });
      return true;
    },
    act: function (x) {
      if (!S.live) return false;
      var a = x.act, id = x.id;
      switch (a) {
        case 'sos': send({ type: 'sos' }); return true;
        case 'cancelAlert': send({ type: 'cancel' }); App.say('Alert cancelled'); return true;
        case 'safeNow': send({ type: 'safe' }); App.say('Your circle was told you’re safe'); return true;
        case 'spike': send({ type: 'vitals', hr: 148, stress: 60 }); return true;
        case 'fall': send({ type: 'vitals', hr: 96, stress: 50, motion: 'fall' }); return true;
        case 'block': api('/api/blocks', 'POST', { userId: id }).then(function () { App.say('Blocked'); }).catch(function (err) { App.say(err.message); }); S.revealed = null; return true;
        case 'unblock': api('/api/blocks/' + encodeURIComponent(id), 'DELETE').then(function () { App.say('Unblocked'); }).catch(function (err) { App.say(err.message); }); return true;
        case 'share':
          var show = function (c) { S.myCode = c; App.render(); copy(c); App.say('Your circle code is ' + c + '. Friends enter it under Join the circle.'); };
          if (me && me.circles.length) show(me.circles[0].code);
          else api('/api/circles', 'POST', {}).then(function (c) { show(c.code); }).catch(function (err) { App.say(err.message); });
          return true;
        case 'pair':
        case 'pairWearable':
          api('/api/devices/pair-code', 'POST').then(function (j) {
            S.pairInfo = 'Open <b>' + location.host + '/pendant/</b> and enter <b style="color:var(--gold);font-family:var(--f-mono)">' + j.code + '</b>. The code works once, for 10 minutes.';
            App.goTab('device'); App.render();
          }).catch(function (err) { App.say(err.message); });
          return true;
        case 'pickDest':
          var p = PLACES.find(function (q) { return q.id === id; });
          if (!p || !myLoc) { App.say('Waiting for your location first'); return true; }
          var at = offset(myLoc, p.miles, p.deg);
          send({ type: 'dest', dest: { name: p.name, lat: at.lat, lng: at.lng } });
          App.say('Route to ' + p.name + ' saved to your wearable. You can leave your phone behind.');
          return true;
        case 'endWalk': send({ type: 'dest', dest: null }); return true;
        case 'walk':
          // Simulated walking: move your spot 40% of the way to whatever you're pointed at.
          var t = App.target();
          if (!t || !myLoc || t.dist >= 99) { App.say('Pick a friend with a location first'); return true; }
          if (!simulated) { simulated = true; if (gpsWatch !== null) navigator.geolocation.clearWatch(gpsWatch); App.say('Switched to simulated walking'); }
          var goal = offset(myLoc, t.dist, t.bearing);
          myLoc = { lat: myLoc.lat + (goal.lat - myLoc.lat) * 0.4, lng: myLoc.lng + (goal.lng - myLoc.lng) * 0.4 };
          store('circle.simLoc', JSON.stringify(myLoc));
          sendLoc();
          return true;
        case 'resetDist': App.say('Distances are live now'); return true;
        case 'accept': case 'decline': return true;
      }
      return false;
    }
  };

  function copy(text) { try { navigator.clipboard.writeText(text).catch(function () {}); } catch (e) {} }
})();
