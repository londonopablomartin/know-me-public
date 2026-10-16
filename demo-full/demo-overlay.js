/* Etiqueta flotante de la demostración: avisa que los datos son ficticios,
 * lista las cuentas de prueba y permite empezar de cero. */
(function () {
  function el(tag, css, html) { var e = document.createElement(tag); e.style.cssText = css; if (html) e.innerHTML = html; return e; }
  function init() {
    var root = el('div', 'position:fixed;top:8px;right:8px;z-index:2147483647;font:13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;');
    var pill = el('button', 'all:unset;cursor:pointer;background:#E11D48;color:#fff;font-weight:700;font-size:12px;padding:7px 12px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.35);', 'DEMO · datos ficticios ▾');
    var panel = el('div', 'display:none;margin-top:8px;width:min(310px,calc(100vw - 16px));background:#121A2B;color:#F1F5F9;border:1px solid #273449;border-radius:16px;padding:14px;box-shadow:0 8px 30px rgba(0,0,0,.5);');
    panel.innerHTML =
      '<div style="font-weight:700;font-size:14px;margin-bottom:6px">Know Me · versión de prueba</div>' +
      '<div style="color:#94A3B8;margin-bottom:10px">Es la app real con un servidor de mentira dentro de tu navegador. Nada se envía ni se guarda fuera de este equipo. El asistente responde con textos de ejemplo.</div>' +
      '<div style="background:#3b2a05;border:1px solid #FBBF24;color:#FDE68A;border-radius:10px;padding:8px 10px;margin-bottom:10px"><b>Los QR de esta demo solo se abren en este navegador.</b> Para probar el escaneo con tu celular usa la app con datos reales: <a href="https://londonopablomartin.github.io/know-me-public/demo/" style="color:#fff;text-decoration:underline">abrir la app real</a>.</div>' +
      '<div style="font-weight:700;margin-bottom:4px">Puedes crear tu propia cuenta o entrar con:</div>' +
      '<div style="background:#1C2842;border-radius:10px;padding:8px 10px;margin-bottom:6px"><b>persona@demo.com</b><br><span style="color:#94A3B8">Persona con ficha completa, sin empresa</span></div>' +
      '<div style="background:#1C2842;border-radius:10px;padding:8px 10px;margin-bottom:6px"><b>empresa@demo.com</b><br><span style="color:#94A3B8">Constructora Aurora · 28 empleados</span></div>' +
      '<div style="background:#1C2842;border-radius:10px;padding:8px 10px;margin-bottom:6px"><b>empleado05@auroraconstructora.co</b><br><span style="color:#94A3B8">Empleado ya vinculado</span></div>' +
      '<div style="color:#94A3B8;margin-bottom:6px">Contraseña de todas: <b style="color:#F1F5F9">demo1234</b> (ficticia)</div>' +
      '<div style="color:#94A3B8;margin-bottom:10px">Código de empresa para vincularte siendo persona: <b style="color:#F1F5F9;letter-spacing:.08em">K7M3QX</b></div>';
    var reset = el('button', 'all:unset;cursor:pointer;display:block;text-align:center;background:#2DD4C7;color:#0B1220;font-weight:700;border-radius:10px;padding:10px;', 'Empezar de cero (borra lo que hiciste)');
    reset.onclick = function () { if (window.__kmDemo) window.__kmDemo.reset(); };
    panel.appendChild(reset);
    pill.onclick = function () { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
    root.appendChild(pill); root.appendChild(panel); document.body.appendChild(root);
  }
  if (document.body) init(); else window.addEventListener('DOMContentLoaded', init);
})();
