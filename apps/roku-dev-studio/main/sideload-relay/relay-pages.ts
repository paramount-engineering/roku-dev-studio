/**
 * HTML pages served by the Sideload Relay ingest server (see relay-server.ts):
 *   - the Roku-style upload page at `GET /`
 *   - the themed login page for a not-yet-authenticated remote device
 *
 * Kept separate from the HTTP/auth logic so each half stays readable. Pure
 * string builders — no I/O, no state.
 */

/** Minimal HTML-attribute/text escaper for values interpolated into the page. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The actual Roku Dev Studio app icon, inline so the served page is self-contained. */
const RDS_LOGO_SVG = `<svg width="46" height="46" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="rds-logo">
  <defs>
    <linearGradient id="rdsBg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#252540"/><stop offset="50%" stop-color="#1a1a2e"/><stop offset="100%" stop-color="#0f0f1a"/></linearGradient>
    <linearGradient id="rdsText" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C084FC"/><stop offset="50%" stop-color="#A855F7"/><stop offset="100%" stop-color="#22D3D3"/></linearGradient>
    <linearGradient id="rdsShadow" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#2d1f54"/><stop offset="100%" stop-color="#1a1030"/></linearGradient>
    <filter id="rdsGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="50" y="50" width="924" height="924" rx="190" ry="190" fill="url(#rdsBg)"/>
  <rect x="50" y="50" width="924" height="924" rx="190" ry="190" fill="none" stroke="#3d3d5c" stroke-width="3"/>
  <g>
    <text x="512" y="344" font-family="system-ui,-apple-system,sans-serif" font-size="240" font-weight="900" fill="url(#rdsShadow)" text-anchor="middle" letter-spacing="-6">Roku</text>
    <text x="512" y="571" font-family="system-ui,-apple-system,sans-serif" font-size="240" font-weight="900" fill="url(#rdsShadow)" text-anchor="middle" letter-spacing="-6">Dev</text>
    <text x="512" y="798" font-family="system-ui,-apple-system,sans-serif" font-size="240" font-weight="900" fill="url(#rdsShadow)" text-anchor="middle" letter-spacing="-6">Studio</text>
  </g>
  <g filter="url(#rdsGlow)">
    <text x="512" y="328" font-family="system-ui,-apple-system,sans-serif" font-size="240" font-weight="900" fill="url(#rdsText)" text-anchor="middle" letter-spacing="-6">Roku</text>
    <text x="512" y="555" font-family="system-ui,-apple-system,sans-serif" font-size="240" font-weight="900" fill="url(#rdsText)" text-anchor="middle" letter-spacing="-6">Dev</text>
    <text x="512" y="782" font-family="system-ui,-apple-system,sans-serif" font-size="240" font-weight="900" fill="url(#rdsText)" text-anchor="middle" letter-spacing="-6">Studio</text>
  </g>
</svg>`;

/**
 * The Roku-style Sideload Relay upload page served at `GET /`. Lets a browser
 * drop a `.zip`/`.pkg` and install it through Roku Dev Studio. Same-machine
 * visitors skip the password; remote visitors must supply the relay Dev
 * Password and additionally get the allow-prompt on the host.
 */
export function renderUploadPage(opts: {
  sameMachine: boolean;
  targets: { name: string; ip: string }[];
}): string {
  const { sameMachine, targets } = opts;
  const deviceCards = targets.length
    ? targets
        .map(
          (t) =>
            `<li class="dev"><span class="dev-dot"></span><span class="dev-name">${esc(t.name)}</span><span class="dev-ip">${esc(
              t.ip
            )}</span></li>`
        )
        .join('')
    : '<li class="dev empty">No target devices configured yet. Add devices in Roku Dev Studio → Settings → Sideload Relay.</li>';

  // This machine (same IP as the host) proceeds without a password. A remote
  // visitor already authenticated (cookie session) just to load this page.
  const passwordField = sameMachine
    ? '<p class="same-machine">✓ This is the Roku Dev Studio machine — no password needed.</p>'
    : '<p class="hint">✓ Authenticated. The host will be asked to allow this device when you install.</p>';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Roku Dev Studio — Sideload Relay</title>
<style>
  :root{--bg:#12121f;--card:#1a1a2e;--card2:#22223a;--border:#2a2a40;--text:#e8e8f0;--muted:#9a9ab5;--accent:#a855f7;--accent2:#c084fc;--cyan:#22d3ee;--green:#4ade80;--red:#f87171}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#1f1640 0%,var(--bg) 60%);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100vh}
  .wrap{max-width:640px;margin:0 auto;padding:40px 20px 64px}
  header{display:flex;align-items:center;gap:14px;margin-bottom:8px}
  .rds-logo{border-radius:11px;filter:drop-shadow(0 4px 14px rgba(124,58,237,.45));flex:none}
  header h1{font-size:20px;margin:0;font-weight:650;letter-spacing:-.02em;background:linear-gradient(100deg,#c084fc,#a855f7 55%,#22d3ee);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  header .sub{color:var(--muted);font-size:12.5px;margin-top:2px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;margin-top:18px}
  .card h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:0 0 12px}
  ul.devices{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .dev{display:flex;align-items:center;gap:10px;background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:10px 12px}
  .dev-dot{width:8px;height:8px;border-radius:50%;background:var(--green);flex:none;box-shadow:0 0 0 3px rgba(76,194,122,.15)}
  .dev-name{font-weight:550}
  .dev-ip{color:var(--muted);font:12px ui-monospace,Menlo,monospace;margin-left:auto}
  .dev.empty{color:var(--muted);justify-content:center;display:block;text-align:center}
  ol.guide{margin:0;padding-left:20px;color:var(--muted);display:flex;flex-direction:column;gap:6px}
  ol.guide b{color:var(--text);font-weight:550}
  .drop{border:1.5px dashed var(--border);border-radius:12px;padding:26px 18px;text-align:center;cursor:pointer;transition:.15s;background:var(--card2)}
  .drop:hover,.drop.over{border-color:var(--accent);background:rgba(139,92,246,.08)}
  .drop .big{font-weight:600;font-size:15px}
  .drop .small{color:var(--muted);font-size:12.5px;margin-top:4px}
  .file-name{margin-top:12px;font:12.5px ui-monospace,Menlo,monospace;color:var(--accent2);word-break:break-all}
  .field-label{display:block;font-size:12px;color:var(--muted);margin:16px 0 6px;text-transform:uppercase;letter-spacing:.04em}
  input[type=password]{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:11px 12px;color:var(--text);font-size:14px}
  input[type=password]:focus{outline:none;border-color:var(--accent)}
  .hint,.same-machine{font-size:12.5px;color:var(--muted);margin:8px 0 0}
  .same-machine{color:var(--green)}
  button.install{margin-top:18px;width:100%;background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border:0;border-radius:10px;padding:13px;font-size:15px;font-weight:600;cursor:pointer}
  button.install:disabled{opacity:.5;cursor:not-allowed}
  .result{margin-top:16px;padding:12px 14px;border-radius:10px;font-size:13.5px;display:none}
  .result.ok{display:block;background:rgba(76,194,122,.12);border:1px solid rgba(76,194,122,.4);color:var(--green)}
  .result.err{display:block;background:rgba(229,106,106,.12);border:1px solid rgba(229,106,106,.4);color:var(--red)}
  .result.info{display:block;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.4);color:var(--accent2)}
</style></head>
<body><div class="wrap">
  <header>${RDS_LOGO_SVG}<div><h1>Roku Dev Studio</h1><div class="sub">Sideload Relay — install one build on every device</div></div></header>

  <div class="card"><h2>How it works</h2>
    <ol class="guide">
      <li>Drop your channel <b>.zip</b> or <b>.pkg</b> below and click <b>Install</b>.</li>
      <li>Roku Dev Studio installs it on <b>every target device</b> listed here, then launches the dev channel.</li>
      <li>Watch progress on the debug console (port 8085) or in the Roku Dev Studio window.</li>
    </ol>
  </div>

  <div class="card"><h2>Target devices (${targets.length})</h2>
    <ul class="devices">${deviceCards}</ul>
  </div>

  <div class="card"><h2>Upload channel</h2>
    <form id="f">
      <div class="drop" id="drop">
        <div class="big">Drop .zip or .pkg here or click to choose</div>
        <div class="small">Your packaged BrightScript channel (.zip or .pkg)</div>
        <input id="file" name="archive" type="file" accept=".zip,.pkg,application/zip,application/octet-stream" hidden />
      </div>
      <div class="file-name" id="fname"></div>
      ${passwordField}
      <button class="install" id="go" type="submit" disabled>Install to ${targets.length} device${
        targets.length === 1 ? '' : 's'
      }</button>
      <div class="result" id="res"></div>
    </form>
  </div>
</div>
<script>
  var drop=document.getElementById('drop'),file=document.getElementById('file'),fname=document.getElementById('fname'),
      go=document.getElementById('go'),res=document.getElementById('res'),f=document.getElementById('f');
  function setFile(list){var x=list&&list[0];if(!x)return;file.files=list;fname.textContent=x.name+' ('+Math.round(x.size/1024)+' KB)';go.disabled=false;}
  drop.addEventListener('click',function(){file.click();});
  file.addEventListener('change',function(){setFile(file.files);});
  ['dragenter','dragover'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.add('over');});});
  ['dragleave','drop'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.remove('over');});});
  drop.addEventListener('drop',function(ev){if(ev.dataTransfer&&ev.dataTransfer.files)setFile(ev.dataTransfer.files);});
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    if(!file.files||!file.files[0]){return;}
    var fd=new FormData();fd.append('archive',file.files[0]);
    var pwd=document.getElementById('pwd');if(pwd)fd.append('password',pwd.value||'');
    go.disabled=true;res.className='result info';res.textContent='Uploading… if this is a remote device, approve the prompt on the Roku Dev Studio machine.';
    fetch('/relay_upload',{method:'POST',body:fd}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.success){res.className='result ok';res.textContent=j.message||'Install Success.';}
      else{res.className='result err';res.textContent=(j&&j.error)||'Install failed.';}
    }).catch(function(){res.className='result err';res.textContent='Upload failed — is Roku Dev Studio still running?';})
    .then(function(){go.disabled=false;});
  });
</script>
</body></html>`;
}

/**
 * Themed login page served to a remote device that hasn't authenticated yet.
 * The device can't see the target list or the uploader until it posts the
 * correct Dev Password to `/relay_login` (which sets the session cookie).
 */
export function renderLoginPage(): string {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Roku Dev Studio — Sign in</title>
<style>
  :root{--bg:#12121f;--card:#1a1a2e;--border:#2a2a40;--text:#e8e8f0;--muted:#9a9ab5;--accent:#a855f7;--accent2:#c084fc;--red:#f87171}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#1f1640 0%,var(--bg) 60%);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .box{width:100%;max-width:360px;padding:28px;background:var(--card);border:1px solid var(--border);border-radius:16px;text-align:center;margin:20px}
  .rds-logo{border-radius:11px;filter:drop-shadow(0 4px 14px rgba(124,58,237,.45));margin-bottom:14px}
  h1{font-size:18px;margin:0 0 4px;font-weight:650}
  .sub{color:var(--muted);font-size:12.5px;margin-bottom:20px}
  input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:12px;color:var(--text);font-size:15px;text-align:center}
  input:focus{outline:none;border-color:var(--accent)}
  button{margin-top:14px;width:100%;background:linear-gradient(180deg,var(--accent2),var(--accent));color:#fff;border:0;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer}
  button:disabled{opacity:.5;cursor:not-allowed}
  .err{margin-top:12px;font-size:13px;color:var(--red);min-height:1em}
</style></head>
<body>
  <form class="box" id="lf">
    ${RDS_LOGO_SVG}
    <h1>Roku Dev Studio</h1>
    <div class="sub">Enter the Sideload Relay Dev Password to continue.</div>
    <input id="pw" type="password" autocomplete="current-password" placeholder="Dev Password" autofocus />
    <button id="btn" type="submit">Sign in</button>
    <div class="err" id="err"></div>
  </form>
<script>
  var lf=document.getElementById('lf'),pw=document.getElementById('pw'),btn=document.getElementById('btn'),err=document.getElementById('err');
  lf.addEventListener('submit',function(ev){
    ev.preventDefault();
    err.textContent='';btn.disabled=true;
    var fd=new FormData();fd.append('password',pw.value||'');
    fetch('/relay_login',{method:'POST',body:fd}).then(function(r){return r.json();}).then(function(j){
      if(j&&j.ok){location.reload();}
      else{err.textContent=(j&&j.error)||'Incorrect password.';btn.disabled=false;pw.select();}
    }).catch(function(){err.textContent='Could not reach Roku Dev Studio.';btn.disabled=false;});
  });
</script>
</body></html>`;
}
