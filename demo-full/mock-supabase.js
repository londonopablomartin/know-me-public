/* Servidor de demostración de Know Me, dentro del navegador.
 *
 * Reemplaza `fetch` para las llamadas que la app hace a Supabase (cuentas,
 * tablas, funciones, almacenamiento) y las responde con una base de datos
 * ficticia guardada en localStorage. La app que corre encima es la real:
 * mismas pantallas, mismas reglas; solo cambia el servidor.
 *
 * Nada sale de tu navegador: no hay red, no hay base de datos real, no hay
 * correos ni IA real (el asistente responde con textos de ejemplo).
 */
(function () {
  var DEMO_HOST = 'demo.invalid';
  var DB_KEY = 'km_demo_db_v1';
  var DEMO_PASSWORD = 'demo1234';
  var realFetch = window.fetch.bind(window);

  /* ───────── utilidades ───────── */
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); }
  function nowIso() { return new Date().toISOString(); }
  function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
  function hex(n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function b64url(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function makeJwt(user) {
    var now = Math.floor(Date.now() / 1000);
    return b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' +
      b64url(JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 86400 * 30, user_metadata: user.meta })) + '.demo';
  }
  function uidFromHeaders(h) {
    var a = h['authorization'] || '';
    if (a.indexOf('Bearer ') !== 0) return null;
    var parts = a.slice(7).split('.');
    if (parts.length < 2) return null;
    try { var p = JSON.parse(b64urlDecode(parts[1])); return p.role === 'authenticated' ? p.sub : null; } catch (e) { return null; }
  }
  function json(data, status, extra) {
    var headers = { 'content-type': 'application/json' };
    if (extra) for (var k in extra) headers[k] = extra[k];
    return new Response(status === 204 ? null : JSON.stringify(data), { status: status || 200, headers: headers });
  }
  function pgError(code, message, status) { return json({ code: code, message: message, details: null, hint: null }, status || 400); }

  /* ───────── base de datos ficticia ───────── */
  var FIRSTS = ['Camila', 'Andrés', 'Valentina', 'Santiago', 'Daniela', 'Mateo', 'Laura', 'Sebastián', 'Natalia', 'Julián', 'Carolina', 'David', 'Paula', 'Felipe', 'Mariana'];
  var LASTS = ['Gómez', 'Rodríguez', 'Martínez', 'López', 'García', 'Hernández', 'Torres', 'Ramírez', 'Díaz', 'Vargas'];
  var SEDES = ['Bogotá Norte', 'Bogotá Sur', 'Medellín'];
  var BLOODS = ['O+', 'A+', 'B+', 'O-', 'AB+', 'A-'];

  function seed() {
    var db = { users: [], app_users: [], persona_profiles: [], emergency_contacts: [], qr_tokens: [], empresa_profiles: [], empresa_employees: [], empresa_employee_roster: [], empresa_sedes: [], arl_documents: [], qr_regeneration_requests: [], access_log: [] };
    function addUser(email, role, meta) {
      var u = { id: uuid(), email: email, password: DEMO_PASSWORD, meta: meta || {}, created_at: daysAgo(40) };
      db.users.push(u);
      db.app_users.push({ id: u.id, email: email, role: role, created_at: u.created_at, terms_accepted_at: u.created_at });
      return u;
    }
    function addToken(pid, notified) { db.qr_tokens.push({ id: uuid(), persona_id: pid, token: hex(64), created_at: daysAgo(30), expires_at: null, revoked_at: null, print_notified_at: notified ? daysAgo(30) : null }); }

    var emp = addUser('empresa@demo.com', 'empresa', { role: 'empresa' });
    db.empresa_profiles.push({ user_id: emp.id, legal_name: 'Constructora Aurora S.A.S.', tax_id: '900123456-7', verification_status: 'pending', verification_doc_url: null, invite_code: 'K7M3QX', arl_name: 'ARL Sura', arl_contact: '018000511414', stale_after_days: 180, logo_url: null, brand_color: 'E11D48', data_controller_ack_at: daysAgo(40), qr_pdf_updated_at: null });
    var sedeIds = {};
    SEDES.forEach(function (n, j) { var s = { id: uuid(), empresa_id: emp.id, name: n, city: j === 2 ? 'Medellín' : 'Bogotá', arl_contact_override: null, created_at: daysAgo(39) }; db.empresa_sedes.push(s); sedeIds[n] = s.id; });

    for (var i = 1; i <= 30; i++) {
      var nm = FIRSTS[i % 15] + ' ' + LASTS[i % 10];
      var em = 'empleado' + String(i).padStart(2, '0') + '@auroraconstructora.co';
      var sd = SEDES[i % 3];
      var u = addUser(em, 'persona', { role: 'persona' });
      if (i <= 24) db.persona_profiles.push({ user_id: u.id, full_name: nm, blood_type: BLOODS[i % 6], allergies: i % 4 === 0 ? ['Penicilina'] : [], conditions: i % 5 === 0 ? ['Asma'] : [], medications: i % 7 === 0 ? ['Losartán'] : [], updated_at: daysAgo(i * 3), health_data_consent_at: daysAgo(i * 3) });
      else if (i <= 27) db.persona_profiles.push({ user_id: u.id, full_name: nm, blood_type: BLOODS[i % 6], allergies: [], conditions: [], medications: [], updated_at: daysAgo(210), health_data_consent_at: daysAgo(215) });
      else db.persona_profiles.push({ user_id: u.id, full_name: nm, blood_type: null, allergies: [], conditions: [], medications: [], updated_at: daysAgo(2), health_data_consent_at: null });
      if (i <= 27) db.emergency_contacts.push({ id: uuid(), persona_id: u.id, full_name: 'Contacto de ' + nm.split(' ')[0], phone: '300' + String(1000000 + i), relationship: 'Familiar' });
      addToken(u.id, false);
      db.empresa_employee_roster.push({ id: uuid(), empresa_id: emp.id, full_name: nm, email: em, matched_persona_id: i <= 28 ? u.id : null, matched_at: i <= 28 ? daysAgo(30 - i) : null, created_at: daysAgo(39), sede_name: sd });
      if (i <= 28) db.empresa_employees.push({ id: uuid(), empresa_id: emp.id, persona_id: u.id, joined_at: daysAgo(30 - i), sede_id: sedeIds[sd] });
      if (i === 4 || i === 8) db.qr_regeneration_requests.push({ id: uuid(), persona_id: u.id, reason: i === 4 ? 'Perdí mi tarjeta' : 'Se dañó en el lavado', reviewer_type: 'empresa', empresa_id: emp.id, status: 'pending', approval_token: null, reviewed_at: null, created_at: daysAgo(1) });
    }
    var ana = addUser('persona@demo.com', 'persona', { role: 'persona' });
    db.persona_profiles.push({ user_id: ana.id, full_name: 'Ana Ruiz', blood_type: 'O+', allergies: ['Penicilina', 'Maní'], conditions: ['Asma'], medications: ['Salbutamol'], updated_at: daysAgo(5), health_data_consent_at: daysAgo(5) });
    db.emergency_contacts.push({ id: uuid(), persona_id: ana.id, full_name: 'Carlos Ruiz', phone: '3001234567', relationship: 'Esposo' });
    addToken(ana.id, true);
    return db;
  }

  var db;
  function load() { try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; } if (!db) { db = seed(); save(); } }
  function save() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* sin almacenamiento: sigue en memoria */ } }
  load();

  function userById(id) { return db.users.filter(function (u) { return u.id === id; })[0]; }
  function userOut(u) {
    return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: u.created_at, phone: '', confirmed_at: u.created_at, last_sign_in_at: nowIso(),
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.meta, identities: [], created_at: u.created_at, updated_at: nowIso(), is_anonymous: false };
  }
  function sessionOut(u) {
    return { access_token: makeJwt(u), token_type: 'bearer', expires_in: 86400 * 30, expires_at: Math.floor(Date.now() / 1000) + 86400 * 30, refresh_token: 'demo-refresh-' + u.id, user: userOut(u) };
  }

  /* ───────── reglas de negocio (las mismas funciones de la base real) ───────── */
  function profileOf(id) { return db.persona_profiles.filter(function (p) { return p.user_id === id; })[0]; }
  function isComplete(id) {
    var p = profileOf(id);
    if (!p || !(p.full_name || '').trim() || !p.health_data_consent_at) return false;
    return db.emergency_contacts.some(function (c) { return c.persona_id === id && (c.phone || '').trim(); });
  }
  function activeToken(pid) { return db.qr_tokens.filter(function (t) { return t.persona_id === pid && !t.revoked_at; }).sort(function (a, b) { return b.created_at < a.created_at ? -1 : 1; })[0]; }
  function empresaOf(pid) { return db.empresa_employees.filter(function (e) { return e.persona_id === pid; })[0]; }
  function inviteCode() { var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', c; do { c = ''; for (var i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)]; } while (db.empresa_profiles.some(function (e) { return e.invite_code === c; })); return c; }

  var RPC = {
    get_empresa_dashboard: function (uid) {
      var ep = db.empresa_profiles.filter(function (e) { return e.user_id === uid; })[0];
      var threshold = ep ? ep.stale_after_days : 180;
      var cutoff = Date.now() - threshold * 86400000;
      var emps = db.empresa_employees.filter(function (e) { return e.empresa_id === uid && profileOf(e.persona_id); })
        .sort(function (a, b) { return a.joined_at < b.joined_at ? 1 : -1; })
        .map(function (e) {
          var p = profileOf(e.persona_id), au = db.app_users.filter(function (a) { return a.id === e.persona_id; })[0];
          var sede = db.empresa_sedes.filter(function (s) { return s.id === e.sede_id; })[0];
          return { persona_id: e.persona_id, full_name: p.full_name, email: au && au.email, joined_at: e.joined_at, profile_updated_at: p.updated_at, sede_id: e.sede_id, sede_name: sede ? sede.name : null,
            is_stale: !p.updated_at || new Date(p.updated_at).getTime() < cutoff, is_incomplete: !isComplete(e.persona_id) };
        });
      var roster = db.empresa_employee_roster.filter(function (r) { return r.empresa_id === uid; });
      return { employee_count: emps.length, employees: emps, stale_after_days: threshold,
        stale_count: emps.filter(function (e) { return e.is_stale; }).length, incomplete_count: emps.filter(function (e) { return e.is_incomplete; }).length,
        roster_total: roster.length, roster_matched: roster.filter(function (r) { return r.matched_persona_id; }).length,
        roster_pending: roster.filter(function (r) { return !r.matched_persona_id; }).sort(function (a, b) { return a.full_name < b.full_name ? -1 : 1; }).map(function (r) { return { full_name: r.full_name, email: r.email, sede_name: r.sede_name }; }),
        sedes: db.empresa_sedes.filter(function (s) { return s.empresa_id === uid; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (s) { return { id: s.id, name: s.name, city: s.city }; }) };
    },
    link_to_empresa: function (uid, a) {
      var code = String(a.p_code || '').trim().toUpperCase();
      var ep = db.empresa_profiles.filter(function (e) { return e.invite_code === code; })[0];
      if (!ep) return { error: 'invalid_code' };
      var au = db.app_users.filter(function (x) { return x.id === uid; })[0];
      var email = ((au && au.email) || '').toLowerCase();
      var roster = db.empresa_employee_roster.filter(function (r) { return r.empresa_id === ep.user_id && r.email.toLowerCase() === email && !r.matched_persona_id; })[0];
      var sedeId = null;
      if (roster && roster.sede_name) { var s = db.empresa_sedes.filter(function (x) { return x.empresa_id === ep.user_id && x.name.toLowerCase() === roster.sede_name.toLowerCase(); })[0]; if (s) sedeId = s.id; }
      var existing = empresaOf(uid);
      if (existing) { existing.empresa_id = ep.user_id; existing.joined_at = nowIso(); existing.sede_id = sedeId || existing.sede_id; }
      else db.empresa_employees.push({ id: uuid(), empresa_id: ep.user_id, persona_id: uid, joined_at: nowIso(), sede_id: sedeId });
      if (roster) { roster.matched_persona_id = uid; roster.matched_at = nowIso(); }
      return { empresa_name: ep.legal_name };
    },
    get_my_empresa_branding: function (uid) {
      var l = empresaOf(uid); if (!l) return null;
      var ep = db.empresa_profiles.filter(function (e) { return e.user_id === l.empresa_id; })[0]; if (!ep) return null;
      return { legal_name: ep.legal_name, logo_url: ep.logo_url, brand_color: ep.brand_color, my_sede_id: l.sede_id,
        sedes: db.empresa_sedes.filter(function (s) { return s.empresa_id === l.empresa_id; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (s) { return { id: s.id, name: s.name, city: s.city }; }) };
    },
    set_my_sede: function (uid, a) {
      var l = empresaOf(uid); if (!l) return { error: 'not_linked' };
      if (a.p_sede_id) { var s = db.empresa_sedes.filter(function (x) { return x.id === a.p_sede_id; })[0]; if (!s || s.empresa_id !== l.empresa_id) return { error: 'invalid_sede' }; }
      l.sede_id = a.p_sede_id || null; return { ok: true };
    },
    get_empresa_pending_qr_requests: function (uid) {
      return db.qr_regeneration_requests.filter(function (r) { return r.empresa_id === uid && r.status === 'pending'; }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; })
        .map(function (r) { var p = profileOf(r.persona_id); return { id: r.id, persona_full_name: p && p.full_name, reason: r.reason, created_at: r.created_at }; });
    },
    get_empresa_print_status: function (uid) {
      var ep = db.empresa_profiles.filter(function (e) { return e.user_id === uid; })[0];
      var pending = 0, sent = 0, incomplete = 0;
      db.empresa_employees.filter(function (e) { return e.empresa_id === uid && profileOf(e.persona_id); }).forEach(function (e) {
        if (!isComplete(e.persona_id)) { incomplete++; return; }
        var t = activeToken(e.persona_id);
        if (!t) return;
        if (t.print_notified_at) sent++; else pending++;
      });
      return { pending: pending, sent: sent, incomplete: incomplete, last_sent_at: ep ? ep.qr_pdf_updated_at : null };
    },
    get_or_create_my_qr_token: function (uid) {
      if (!uid) return { error: 'not_authenticated' };
      var t = activeToken(uid), created = false;
      if (!t) { t = { id: uuid(), persona_id: uid, token: hex(64), created_at: nowIso(), expires_at: null, revoked_at: null, print_notified_at: null }; db.qr_tokens.push(t); created = true; }
      return { id: t.id, persona_id: t.persona_id, token: t.token, created_at: t.created_at, print_notified_at: t.print_notified_at, created: created };
    },
    request_qr_regeneration: function (uid, a) {
      var reason = String(a.p_reason || '').trim().slice(0, 500);
      if (!reason) return { error: 'reason_required' };
      var l = empresaOf(uid), r = { id: uuid(), persona_id: uid, reason: reason, reviewer_type: l ? 'empresa' : 'knowme', empresa_id: l ? l.empresa_id : null, status: 'pending', approval_token: null, reviewed_at: null, created_at: nowIso() };
      db.qr_regeneration_requests.push(r);
      return { request_id: r.id, reviewer_type: r.reviewer_type };
    },
    get_my_qr_requests: function (uid) {
      return db.qr_regeneration_requests.filter(function (r) { return r.persona_id === uid; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; })
        .map(function (r) { return { id: r.id, reason: r.reason, reviewer_type: r.reviewer_type, status: r.status, created_at: r.created_at, reviewed_at: r.reviewed_at }; });
    },
    resolve_emergency_qr: function (uid, a) {
      var t = db.qr_tokens.filter(function (x) { return x.token === a.p_token; })[0];
      if (!t) return { error: 'not_found' };
      if (t.revoked_at) return { error: 'revoked' };
      var p = profileOf(t.persona_id) || {};
      db.access_log.push({ qr_token_id: t.id, accessed_at: nowIso() });
      return { full_name: p.full_name, blood_type: p.blood_type, allergies: p.allergies || [], conditions: p.conditions || [], medications: p.medications || [],
        contacts: db.emergency_contacts.filter(function (c) { return c.persona_id === t.persona_id; }).map(function (c) { return { full_name: c.full_name, phone: c.phone, relationship: c.relationship }; }) };
    }
  };

  /* ───────── funciones del servidor (simuladas) ───────── */
  function chatReply(messages) {
    var all = messages.map(function (m) { return (m.content || '').toLowerCase(); });
    var last = all[all.length - 1] || '';
    var calledBefore = all.slice(0, -1).some(function (t) { return /ya llam|llamé|llame|llamamos|pedí ayuda|pedi ayuda/.test(t); }) || /ya llam|llamé|llame|llamamos/.test(last);
    var tail = ' (Respuesta simulada de la demostración.)';
    function pre(t) { return calledBefore ? t : '¿Ya llamaste al 123? ' + t; }
    if (/atragant|ahog|se esta ahogando|se está ahogando/.test(last)) return pre('Inclínalo hacia adelante y dale 5 golpes firmes entre los omóplatos. Si no sale, abrázalo por detrás y haz 5 compresiones sobre el ombligo. Repite hasta que expulse el objeto.') + ' ¿Está respirando ahora?' + tail;
    if (/sangr|hemorrag|herida|corte/.test(last)) return pre('Presiona la herida con un paño limpio y no lo retires. Si el paño se empapa, pon otro encima. Mantén la zona elevada.') + ' ¿El sangrado ha disminuido?' + tail;
    if (/no respira|inconsciente|desmay|no responde|paro/.test(last)) return pre('Acuéstalo boca arriba en una superficie firme. Revisa si respira. Si no respira, empuja fuerte y rápido en el centro del pecho, unas 100 veces por minuto.') + ' ¿Respira o se mueve?' + tail;
    if (/convuls/.test(last)) return pre('Aparta objetos cercanos y protege su cabeza con algo blando. No le metas nada en la boca. Cuando pare, colócalo de lado.') + ' ¿Ya terminó la convulsión?' + tail;
    if (/quemad/.test(last)) return pre('Enfría la zona con agua corriente fresca durante 10 minutos. No uses hielo ni cremas. Cúbrela con un paño limpio y húmedo.') + ' ¿La quemadura es más grande que una mano?' + tail;
    if (/dolor de pecho|pecho|infarto/.test(last)) return pre('Siéntalo con la espalda apoyada y aflója la ropa. Mantenlo quieto y tranquilo. No le des comida ni bebida.') + ' ¿El dolor se extiende al brazo o a la mandíbula?' + tail;
    if (/hola|buenas|ayuda/.test(last)) return '¿Ya llamaste al 123? Descríbeme en una frase qué le pasa a la persona y dónde está.' + tail;
    return pre('Cuéntame qué está pasando ahora mismo y si la persona respira y responde.') + ' ¿Puedes describir lo que ves?' + tail;
  }
  var FUNCTIONS = {
    'claude-proxy': function (uid, body) { if (!uid) return [401, { error: 'not_authenticated' }]; return [200, { reply: chatReply((body && body.messages) || []) }]; },
    'nearby-hospitals': function (uid, body) {
      var lat = (body && body.lat) || 4.711, lon = (body && body.lon) || -74.0721, out = [];
      var offs = [[0.004, 0.003, 520], [-0.006, 0.005, 980], [0.009, -0.004, 1450], [-0.011, -0.008, 2100], [0.015, 0.012, 2900]];
      offs.forEach(function (o, i) { out.push({ name: 'Centro médico de ejemplo ' + String.fromCharCode(65 + i), lat: lat + o[0], lon: lon + o[1], distance_meters: o[2], phone: '601' + String(2000000 + i * 1234) }); });
      return [200, { hospitals: out }];
    },
    'notify-qr-print': function (uid, body) {
      if (empresaOf(uid)) return [200, { ok: true, deferred_to_empresa_batch: true }];
      var t = db.qr_tokens.filter(function (x) { return x.persona_id === uid && x.token === (body && body.token); })[0];
      if (!t) return [404, { error: 'token_not_found' }];
      if (t.print_notified_at) return [200, { ok: true, already_notified: true }];
      if (!isComplete(uid)) return [409, { error: 'profile_incomplete' }];
      t.print_notified_at = nowIso(); save(); return [200, { ok: true }];
    },
    'notify-qr-regeneration-request': function () { return [200, { ok: true }]; },
    'send-empresa-print-batch': function (uid) {
      var ep = db.empresa_profiles.filter(function (e) { return e.user_id === uid; })[0];
      if (!ep) return [403, { error: 'not_empresa' }];
      var rows = db.empresa_employees.filter(function (e) { return e.empresa_id === uid && profileOf(e.persona_id) && isComplete(e.persona_id) && activeToken(e.persona_id) && !activeToken(e.persona_id).print_notified_at; });
      if (!rows.length) return [409, { error: 'nothing_to_print' }];
      rows.forEach(function (e) { activeToken(e.persona_id).print_notified_at = nowIso(); });
      ep.qr_pdf_updated_at = nowIso(); save();
      return [200, { ok: true, sent: rows.length, remaining: 0 }];
    },
    'process-arl-document': function (uid, body) { var d = db.arl_documents.filter(function (x) { return x.id === (body && body.document_id); })[0]; if (d) { d.status = 'ready'; save(); } return [200, { ok: true, chunk_count: 12 }]; },
    'review-qr-regeneration': function (uid, body) {
      var r = db.qr_regeneration_requests.filter(function (x) { return x.id === (body && body.request_id); })[0];
      if (!r || r.status !== 'pending') return [200, { ok: false }];
      r.reviewed_at = nowIso();
      if (body.action === 'approve') {
        db.qr_tokens.forEach(function (t) { if (t.persona_id === r.persona_id && !t.revoked_at) t.revoked_at = nowIso(); });
        db.qr_tokens.push({ id: uuid(), persona_id: r.persona_id, token: hex(64), created_at: nowIso(), expires_at: null, revoked_at: null, print_notified_at: nowIso() });
        r.status = 'approved';
      } else r.status = 'rejected';
      save(); return [200, { ok: true }];
    },
    'request-password-reset': function (uid, body) {
      return [200, { ok: true }];
    },
    'delete-account': function (uid, body) {
      if (!uid) return [401, { error: 'invalid_session' }];
      var who = userById(uid);
      if (who && (!body || body.password !== who.password)) return [403, { error: body && body.password ? 'wrong_password' : 'password_required' }];
      var ids = db.qr_tokens.filter(function (t) { return t.persona_id === uid; }).map(function (t) { return t.id; });
      ['persona_profiles'].forEach(function (k) { db[k] = db[k].filter(function (r) { return r.user_id !== uid; }); });
      db.emergency_contacts = db.emergency_contacts.filter(function (r) { return r.persona_id !== uid; });
      db.qr_tokens = db.qr_tokens.filter(function (r) { return r.persona_id !== uid; });
      db.access_log = db.access_log.filter(function (r) { return ids.indexOf(r.qr_token_id) < 0; });
      db.empresa_employees = db.empresa_employees.filter(function (r) { return r.persona_id !== uid && r.empresa_id !== uid; });
      db.empresa_profiles = db.empresa_profiles.filter(function (r) { return r.user_id !== uid; });
      db.qr_regeneration_requests = db.qr_regeneration_requests.filter(function (r) { return r.persona_id !== uid; });
      db.app_users = db.app_users.filter(function (r) { return r.id !== uid; });
      db.users = db.users.filter(function (r) { return r.id !== uid; });
      save(); return [200, { ok: true }];
    }
  };

  /* ───────── tablas (equivalente a PostgREST) ───────── */
  var PK = { app_users: 'id', persona_profiles: 'user_id', empresa_profiles: 'user_id' };
  function tableRows(t) { return db[t]; }
  function cmp(a, b) { if (a === b) return 0; if (a === null || a === undefined) return 1; if (b === null || b === undefined) return -1; return a < b ? -1 : 1; }
  function matchFilter(row, key, expr) {
    var neg = false;
    if (expr.indexOf('not.') === 0) { neg = true; expr = expr.slice(4); }
    var i = expr.indexOf('.'), op = expr.slice(0, i), val = expr.slice(i + 1), v = row[key], res;
    if (op === 'eq') res = String(v) === val;
    else if (op === 'neq') res = String(v) !== val;
    else if (op === 'is') res = val === 'null' ? (v === null || v === undefined) : String(v) === val;
    else if (op === 'in') res = val.replace(/^\(|\)$/g, '').split(',').map(function (x) { return x.replace(/^"|"$/g, ''); }).indexOf(String(v)) >= 0;
    else if (op === 'gte') res = v >= val; else if (op === 'lte') res = v <= val; else if (op === 'gt') res = v > val; else if (op === 'lt') res = v < val;
    else res = true;
    return neg ? !res : res;
  }
  function applyFilters(rows, params) {
    var reserved = { select: 1, order: 1, limit: 1, offset: 1, on_conflict: 1, columns: 1 };
    params.forEach(function (val, key) { if (reserved[key]) return; rows = rows.filter(function (r) { return matchFilter(r, key, val); }); });
    return rows;
  }
  function project(row, select) {
    if (!select || select === '*') return row;
    var out = {}; select.split(',').forEach(function (c) { c = c.trim(); if (c && c.indexOf('(') < 0) out[c] = row[c]; }); return out;
  }
  function defaults(table, row) {
    var r = Object.assign({}, row);
    if (['emergency_contacts', 'qr_tokens', 'empresa_sedes', 'arl_documents', 'qr_regeneration_requests', 'empresa_employees', 'empresa_employee_roster'].indexOf(table) >= 0 && !r.id) r.id = uuid();
    if (!r.created_at && ['persona_profiles', 'empresa_profiles', 'app_users'].indexOf(table) < 0) r.created_at = nowIso();
    if (table === 'app_users' && !r.created_at) r.created_at = nowIso();
    if (table === 'persona_profiles') { r.allergies = r.allergies || []; r.conditions = r.conditions || []; r.medications = r.medications || []; r.updated_at = r.updated_at || nowIso(); }
    if (table === 'qr_tokens') { r.revoked_at = r.revoked_at || null; r.expires_at = r.expires_at || null; r.print_notified_at = r.print_notified_at || null; }
    if (table === 'empresa_profiles') { if (!r.invite_code) r.invite_code = inviteCode(); if (r.stale_after_days === undefined) r.stale_after_days = 180; }
    if (table === 'arl_documents') { r.status = r.status || 'pending'; }
    return r;
  }
  function conflictCols(table, params) {
    var oc = params.get('on_conflict'); if (oc) return oc.split(',');
    return PK[table] ? [PK[table]] : ['id'];
  }

  function handleRest(method, table, params, headers, bodyText, uid) {
    if (!db[table]) return pgError('42P01', 'relation "' + table + '" does not exist', 404);
    var prefer = headers['prefer'] || '', wantRep = prefer.indexOf('return=representation') >= 0, single = (headers['accept'] || '').indexOf('vnd.pgrst.object') >= 0;
    var select = params.get('select');
    function out(rows, status) {
      var data = rows.map(function (r) { return project(r, select); });
      if (single) { if (data.length !== 1) return pgError('PGRST116', 'JSON object requested, multiple (or no) rows returned', 406); return json(data[0], status || 200); }
      return json(data, status || 200);
    }
    var rows = tableRows(table), body = bodyText ? JSON.parse(bodyText) : null;

    if (method === 'GET') {
      var found = applyFilters(rows.slice(), params), order = params.get('order');
      if (order) order.split(',').forEach(function (o) { }); // se aplica abajo en orden inverso
      if (order) { var specs = order.split(',').map(function (o) { var p = o.split('.'); return { col: p[0], desc: p[1] === 'desc' }; });
        found.sort(function (a, b) { for (var i = 0; i < specs.length; i++) { var c = cmp(a[specs[i].col], b[specs[i].col]); if (c) return specs[i].desc ? -c : c; } return 0; }); }
      var limit = params.get('limit'); if (limit) found = found.slice(0, parseInt(limit, 10));
      return out(found, 200);
    }
    if (method === 'POST') {
      var items = Array.isArray(body) ? body : [body], created = [], merge = prefer.indexOf('resolution=merge-duplicates') >= 0;
      for (var i = 0; i < items.length; i++) {
        var item = defaults(table, items[i]), cols = conflictCols(table, params);
        var existing = rows.filter(function (r) { return cols.every(function (c) { return String(r[c]).toLowerCase() === String(item[c]).toLowerCase(); }); })[0];
        if (table === 'qr_tokens' && !item.revoked_at && rows.some(function (r) { return r.persona_id === item.persona_id && !r.revoked_at; })) return pgError('23505', 'duplicate key value violates unique constraint "qr_tokens_one_active_per_persona"', 409);
        if (table === 'empresa_sedes' && rows.some(function (r) { return r.empresa_id === item.empresa_id && r.name.toLowerCase() === item.name.toLowerCase(); })) return pgError('23505', 'duplicate key value violates unique constraint "empresa_sedes_empresa_id_name_key"', 409);
        if (existing) {
          if (!merge) return pgError('23505', 'duplicate key value violates unique constraint "' + table + '_pkey"', 409);
          Object.keys(items[i]).forEach(function (k) { existing[k] = items[i][k]; }); created.push(existing);
        } else { rows.push(item); created.push(item); }
      }
      save();
      return wantRep ? out(created, 201) : json(null, 201);
    }
    if (method === 'PATCH') {
      var targets = applyFilters(rows.slice(), params);
      targets.forEach(function (r) { Object.keys(body).forEach(function (k) { r[k] = body[k]; }); });
      save(); return wantRep ? out(targets, 200) : json(null, 204);
    }
    if (method === 'DELETE') {
      var del = applyFilters(rows.slice(), params);
      db[table] = rows.filter(function (r) { return del.indexOf(r) < 0; });
      save(); return wantRep ? out(del, 200) : json(null, 204);
    }
    return pgError('PGRST000', 'método no soportado', 405);
  }

  /* ───────── enrutador ───────── */
  function readBody(init) {
    if (!init || init.body == null) return '';
    var b = init.body;
    if (typeof b === 'string') return b;
    try { return new TextDecoder().decode(b); } catch (e) { return ''; }
  }
  function headersOf(init, input) {
    var h = {}, src = (init && init.headers) || (input && input.headers) || {};
    if (src.forEach && !Array.isArray(src)) src.forEach(function (v, k) { h[String(k).toLowerCase()] = v; });
    else if (Array.isArray(src)) src.forEach(function (p) { h[String(p[0]).toLowerCase()] = p[1]; });
    else Object.keys(src).forEach(function (k) { h[k.toLowerCase()] = src[k]; });
    return h;
  }

  function route(url, method, headers, bodyText) {
    var u = new URL(url), path = u.pathname, params = u.searchParams, uid = uidFromHeaders(headers), m;

    /* Cuentas */
    if (path === '/auth/v1/signup' && method === 'POST') {
      var b = JSON.parse(bodyText || '{}'), email = String(b.email || '').trim().toLowerCase();
      if ((b.password || '').length < 6) return json({ code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' }, 422);
      if (db.users.some(function (x) { return x.email.toLowerCase() === email; })) return json({ code: 422, error_code: 'user_already_exists', msg: 'User already registered' }, 422);
      var nu = { id: uuid(), email: email, password: b.password, meta: Object.assign({ email: email, email_verified: true }, b.data || {}), created_at: nowIso() };
      db.users.push(nu); save(); return json(sessionOut(nu));
    }
    if (path === '/auth/v1/token' && method === 'POST') {
      var gt = params.get('grant_type'), tb = JSON.parse(bodyText || '{}');
      if (gt === 'password') {
        var lu = db.users.filter(function (x) { return x.email.toLowerCase() === String(tb.email || '').trim().toLowerCase() && x.password === tb.password; })[0];
        if (!lu) return json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
        return json(sessionOut(lu));
      }
      if (gt === 'refresh_token') {
        var id = String(tb.refresh_token || '').replace('demo-refresh-', ''), ru = userById(id);
        if (!ru) return json({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400);
        return json(sessionOut(ru));
      }
      return json({ code: 400, msg: 'grant_type no soportado en la demo' }, 400);
    }
    if (path === '/auth/v1/user') { var cu = uid && userById(uid); return cu ? json(userOut(cu)) : json({ code: 401, msg: 'invalid JWT' }, 401); }
    if (path === '/auth/v1/logout') return json(null, 204);
    if (path === '/auth/v1/settings') return json({ external: {}, disable_signup: false, mailer_autoconfirm: true });

    /* Tablas y funciones de base de datos */
    if ((m = path.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/))) {
      var fn = RPC[m[1]]; if (!fn) return pgError('PGRST202', 'función ' + m[1] + ' no existe', 404);
      var pub = m[1] === 'resolve_emergency_qr';
      if (!pub && !uid) return pgError('42501', 'permission denied for function ' + m[1], 401);
      var res = fn(uid, JSON.parse(bodyText || '{}')); save(); return json(res === undefined ? null : res);
    }
    if ((m = path.match(/^\/rest\/v1\/([a-z_]+)$/))) {
      if (!uid) return pgError('42501', 'permission denied for table ' + m[1], 401);
      return handleRest(method, m[1], params, headers, bodyText, uid);
    }

    /* Funciones del servidor */
    if ((m = path.match(/^\/functions\/v1\/([a-z-]+)$/))) {
      var f = FUNCTIONS[m[1]]; if (!f) return json({ error: 'not_found' }, 404);
      var r = f(uid, bodyText ? JSON.parse(bodyText) : {}); return json(r[1], r[0]);
    }

    /* Almacenamiento */
    if (path.indexOf('/storage/v1/object/sign/') === 0) return json({ signedURL: path.replace('/storage/v1', '') + '?token=demo' });
    if (path.indexOf('/storage/v1/object/public/') === 0) {
      var png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), function (c) { return c.charCodeAt(0); });
      return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    if (path.indexOf('/storage/v1/object/') === 0) {
      if (method === 'DELETE') return json([], 200);
      return json({ Key: path.replace('/storage/v1/object/', ''), Id: uuid() });
    }
    return json({ message: 'ruta no soportada en la demo: ' + path }, 404);
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    var host; try { host = new URL(url).hostname; } catch (e) { host = ''; }
    if (host !== DEMO_HOST) return realFetch(input, init);
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    return new Promise(function (resolve) {
      setTimeout(function () {
        try { resolve(route(url, method, headersOf(init, input), readBody(init))); }
        catch (e) { resolve(json({ message: 'error en la demostración: ' + e.message }, 500)); }
      }, 120 + Math.random() * 120); // un poco de espera para que se sienta real
    });
  };

  /* ───────── control de la demo (botón "Reiniciar" y cuentas de prueba) ───────── */
  window.__kmDemo = {
    DEMO_PASSWORD: DEMO_PASSWORD,
    reset: function () {
      try { Object.keys(localStorage).forEach(function (k) { if (k === DB_KEY || k.indexOf('flutter.') === 0 || k.indexOf('supabase') >= 0 || k.indexOf('sb-') === 0) localStorage.removeItem(k); }); } catch (e) { /* ignorar */ }
      location.reload();
    },
    db: function () { return db; }
  };
})();
