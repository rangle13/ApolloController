const DEFAULT_PLAYLISTS = [
  {
    id:'pl1', name:'Evening Sequence', description:'Sunset to night flow',
    targets:['all'], repeat:0, shuffle:false, endPresetId:0,
    steps:[
      {id:'s1', type:'effect', label:'Colorwaves Ocean', durationMs:8000, transitionMs:700, targetOverride:null,
       payload:{on:true,bri:200,transition:7,seg:[{id:0,fx:65,pal:9,sx:100,ix:150,col:[[0,200,255,0],[0,0,0,0],[0,0,0,0]]}]}},
      {id:'s2', type:'effect', label:'Fire Storm', durationMs:6000, transitionMs:400, targetOverride:null,
       payload:{on:true,bri:220,transition:4,seg:[{id:0,fx:66,pal:35,sx:80,ix:180}]}},
      {id:'s3', type:'effect', label:'BPM Rainbow', durationMs:10000, transitionMs:500, targetOverride:null,
       payload:{on:true,bri:200,transition:5,seg:[{id:0,fx:68,pal:11,sx:128,ix:200}]}}
    ]
  },
  {
    id:'pl2', name:'Quick Show', description:'Two device presets',
    targets:['all'], repeat:3, shuffle:false, endPresetId:0,
    steps:[
      {id:'s4', type:'device_preset', label:'Preset #1', presetId:1, durationMs:5000, transitionMs:700, targetOverride:null},
      {id:'s5', type:'device_preset', label:'Preset #2', presetId:2, durationMs:5000, transitionMs:700, targetOverride:null}
    ]
  }
];

// Playlists are kept in an in-memory cache so the rest of this file can keep
// reading/writing them synchronously. The cache is populated from the server
// (GET /api/playlists) on startup and every write is pushed back to the
// server (PUT /api/playlists) in the background, so playlists persist
// across browsers/devices instead of only living in localStorage.
let _playlistsCache = null;

function loadPlaylists() {
  if (_playlistsCache) return _playlistsCache;
  const raw = localStorage.getItem('apollo_playlists');
  if (raw) try { const p = JSON.parse(raw); if (p.length) { _playlistsCache = p; return p; } } catch(e){}
  _playlistsCache = JSON.parse(JSON.stringify(DEFAULT_PLAYLISTS));
  return _playlistsCache;
}

function savePlaylists(p) {
  _playlistsCache = p;
  localStorage.setItem('apollo_playlists', JSON.stringify(p)); // offline fallback
  fetch('/api/playlists', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p)
  }).catch(err => {
    console.error('Failed to save playlists to server:', err);
    if (typeof showToast === 'function') showToast('Could not save playlists to server (saved locally only)', 'warn');
  });
}

// Pull the authoritative copy from the server once at startup. If the
// server already has playlists, they win. If the server has none yet but
// this browser has some in localStorage, migrate them up to the server.
(async function initPlaylistsFromServer() {
  try {
    const res = await fetch('/api/playlists');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const server = await res.json();
    if (Array.isArray(server) && server.length) {
      _playlistsCache = server;
      localStorage.setItem('apollo_playlists', JSON.stringify(server));
    } else {
      const seeded = loadPlaylists(); // local data or defaults
      savePlaylists(seeded);
    }
  } catch (e) {
    console.error('Failed to load playlists from server, using local copy:', e);
  }
  if (window.APP && window.APP.activePage === 'playlist') { renderPlaylists(); renderPlaylistEditor(); }
  if (typeof updateDashPlaylist === 'function') updateDashPlaylist();
})();

let editingPlaylistId = null;
let plEditorTab = 'editor';

// Playlists can be scoped to specific saved devices via their `targets`
// array (device ids, or 'all' for every device). These helpers resolve
// which saved device (if any) matches the currently active IP, and filter
// playlists down to the ones relevant to that device.
function getActiveDeviceForIp(ip) {
  if (!ip) return null;
  const d = loadDevices();
  const all = [...d.matrices, ...d.strings];
  return all.find(dev => dev.ip === ip) || null;
}

function getPlaylistsForIp(ip) {
  const pls = loadPlaylists();
  const dev = getActiveDeviceForIp(ip);
  return pls.filter(pl => pl.targets.includes('all') || (dev && pl.targets.includes(dev.id)));
}

// true = show only playlists targeting the currently connected device (+ "all"); false = show every playlist
let plFilterByDevice = true;

// Playlist tabs
document.getElementById('pl-tab-editor-m1n2').addEventListener('click', () => {
  plEditorTab='editor';
  document.getElementById('pl-editor-q5r6').style.display='block';
  document.getElementById('pl-player-o9p0').style.display='none';
  document.getElementById('pl-tab-editor-m1n2').classList.add('active');
  document.getElementById('pl-tab-player-o3p4').classList.remove('active');
});
document.getElementById('pl-tab-player-o3p4').addEventListener('click', () => {
  plEditorTab='player';
  document.getElementById('pl-editor-q5r6').style.display='none';
  document.getElementById('pl-player-o9p0').style.display='block';
  document.getElementById('pl-tab-editor-m1n2').classList.remove('active');
  document.getElementById('pl-tab-player-o3p4').classList.add('active');
  renderPlayerSteps();
});

document.getElementById('pl-filter-toggle-r7s8').addEventListener('click', () => {
  plFilterByDevice = !plFilterByDevice;
  renderPlaylists();
});

function renderPlaylists() {
  const allPls = loadPlaylists();
  const lib = document.getElementById('playlist-library-i7j8');
  const empty = document.getElementById('pl-empty-state-k9l0');
  const filterLabel = document.getElementById('pl-filter-label-p5q6');
  const filterToggle = document.getElementById('pl-filter-toggle-r7s8');

  const ip = window.APP && window.APP.ip;
  const activeDevice = getActiveDeviceForIp(ip);
  const pls = plFilterByDevice
    ? allPls.filter(pl => pl.targets.includes('all') || (activeDevice && pl.targets.includes(activeDevice.id)))
    : allPls;

  if (filterToggle) filterToggle.textContent = plFilterByDevice ? 'Show all playlists' : 'Filter by device';
  if (filterLabel) {
    if (!plFilterByDevice) {
      filterLabel.textContent = 'Showing: all playlists (' + allPls.length + ')';
    } else if (activeDevice) {
      filterLabel.textContent = 'Showing: playlists for ' + activeDevice.name + ' (' + activeDevice.ip + ')';
    } else if (ip) {
      filterLabel.textContent = 'Showing: "all devices" playlists (' + ip + ' is not a saved device)';
    } else {
      filterLabel.textContent = 'Showing: "all devices" playlists (not connected)';
    }
  }

  lib.innerHTML = '';
  if (pls.length === 0) {
    const emptyMsg = empty.querySelector('p');
    if (emptyMsg) {
      emptyMsg.textContent = (plFilterByDevice && allPls.length)
        ? 'No playlists assigned to this device yet'
        : 'No playlists yet';
    }
    lib.appendChild(empty); empty.style.display = 'block'; return;
  }

  pls.forEach(pl => {
    const isPlaying = ENGINE.running && ENGINE.playlist && ENGINE.playlist.id === pl.id;
    const card = document.createElement('div');
    card.className = 'acard';
    if (isPlaying) { card.classList.add('playlist-playing'); card.style.borderLeft = '3px solid var(--amber)'; }
    card.innerHTML = `
      <div style="margin-bottom:6px;">
        <p style="font-weight:700;font-size:14px;">${pl.name}</p>
        <p style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pl.description||''}</p>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
        <span style="font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px;">${pl.steps.length} steps</span>
        <span style="font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px;">${pl.repeat===0?'∞':'×'+pl.repeat}</span>
        ${pl.shuffle?'<span style="font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px;">🔀</span>':''}
      </div>
      <div style="display:flex;gap:6px;">
        <button class="abtn abtn-amber abtn-sm pl-quick-play" data-plid="${pl.id}">▶ Play</button>
        <button class="abtn abtn-ghost abtn-sm pl-edit" data-plid="${pl.id}">✎ Edit</button>
        <button class="abtn abtn-ghost abtn-sm pl-dup" data-plid="${pl.id}">Copy</button>
        <button class="abtn abtn-danger abtn-sm pl-del" data-plid="${pl.id}">Delete</button>
      </div>
    `;
    lib.appendChild(card);
  });

  lib.querySelectorAll('.pl-quick-play').forEach(btn => btn.addEventListener('click', () => {
    const pl = loadPlaylists().find(p=>p.id===btn.dataset.plid);
    if (pl) { ENGINE.play(pl); showToast('Playing: '+pl.name,'success'); renderPlaylists(); updateDashPlaylist(); }
  }));
  lib.querySelectorAll('.pl-edit').forEach(btn => btn.addEventListener('click', () => {
    editingPlaylistId = btn.dataset.plid;
    renderPlaylistEditor();
  }));
  lib.querySelectorAll('.pl-dup').forEach(btn => btn.addEventListener('click', () => {
    const pls2 = loadPlaylists();
    const src = pls2.find(p=>p.id===btn.dataset.plid);
    if (src) {
      const dup = JSON.parse(JSON.stringify(src));
      dup.id = 'pl'+Date.now(); dup.name += ' (copy)';
      dup.steps.forEach(s => s.id = 's'+Date.now()+Math.random().toString(36).slice(2,5));
      pls2.push(dup); savePlaylists(pls2); renderPlaylists();
    }
  }));
  lib.querySelectorAll('.pl-del').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('Delete this playlist?')) return;
    let pls2 = loadPlaylists().filter(p=>p.id!==btn.dataset.plid);
    savePlaylists(pls2);
    if (editingPlaylistId === btn.dataset.plid) { editingPlaylistId = null; renderPlaylistEditor(); }
    renderPlaylists();
  }));
}

// New playlist
document.getElementById('new-playlist-g5h6').addEventListener('click', () => {
  const pls = loadPlaylists();
  const np = { id:'pl'+Date.now(), name:'New Playlist', description:'', targets:['all'], repeat:0, shuffle:false, endPresetId:0, steps:[] };
  pls.push(np); savePlaylists(pls);
  editingPlaylistId = np.id;
  renderPlaylists(); renderPlaylistEditor();
});

function renderPlaylistEditor() {
  const noEdit = document.getElementById('pl-no-edit-s7t8');
  const form = document.getElementById('pl-edit-form-u9v0');
  if (!editingPlaylistId) { noEdit.style.display='block'; form.style.display='none'; return; }
  noEdit.style.display='none'; form.style.display='block';

  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (!pl) return;

  document.getElementById('ple-name-w1x2').value = pl.name;
  document.getElementById('ple-desc-y3z4').value = pl.description||'';
  document.getElementById('ple-repeat-a5b6').value = pl.repeat;
  document.getElementById('ple-shuffle-c7d8').checked = pl.shuffle;
  document.getElementById('ple-endpreset-e9f0').value = pl.endPresetId||0;

  // Targets
  const tDiv = document.getElementById('ple-targets-g1h2');
  tDiv.innerHTML = '';
  const d = loadDevices();
  const allDevs = [...d.matrices, ...d.strings];
  const allCb = document.createElement('label');
  allCb.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;';
  allCb.innerHTML = '<input type="checkbox" class="ple-tgt" value="all" style="width:auto;" '+(pl.targets.includes('all')?'checked':'')+' /> All Devices';
  tDiv.appendChild(allCb);
  allDevs.forEach(dev => {
    const lb = document.createElement('label');
    lb.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;';
    lb.innerHTML = '<input type="checkbox" class="ple-tgt" value="'+dev.id+'" style="width:auto;" '+(pl.targets.includes(dev.id)?'checked':'')+' /> '+dev.name;
    tDiv.appendChild(lb);
  });

  // Steps
  renderPlaylistSteps(pl);
}

function renderPlaylistSteps(pl) {
  const list = document.getElementById('ple-step-list-m7n8');
  list.innerHTML = '';
  if (!pl.steps.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--muted);text-align:center;padding:16px;">No steps yet</p>';
    return;
  }
  pl.steps.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = 'step-card';
    const typeColor = step.type==='device_preset'?'var(--amber)':'var(--indigo)';
    const typeLabel = step.type==='device_preset'?'PRESET':'EFFECT';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="cursor:grab;color:var(--muted);font-size:16px;">⠿</span>
        <span style="background:var(--bg);font-size:11px;padding:2px 6px;border-radius:4px;font-weight:600;">#${idx+1}</span>
        <span style="background:${typeColor};color:${step.type==='device_preset'?'#000':'#fff'};font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;">${typeLabel}</span>
        <span style="flex:1;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${step.label}</span>
        <span style="font-size:11px;color:var(--muted);">${(step.durationMs/1000).toFixed(1)}s</span>
        <span style="font-size:11px;color:var(--muted);">T:${step.transitionMs}ms</span>
        <button class="step-expand abtn abtn-ghost" style="padding:2px 6px;font-size:14px;" data-idx="${idx}">▼</button>
        <button class="step-del abtn abtn-danger" style="padding:2px 6px;font-size:12px;" data-idx="${idx}">✕</button>
      </div>
      <div class="step-details" data-idx="${idx}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
        <div style="display:grid;gap:8px;">
          <div><label style="font-size:11px;color:var(--muted);">Label</label><input type="text" class="sd-label" data-idx="${idx}" value="${step.label}" style="font-size:12px;" /></div>
          <div style="display:flex;gap:8px;">
            <div style="flex:1;"><label style="font-size:11px;color:var(--muted);">Duration (ms)</label><input type="number" class="sd-dur" data-idx="${idx}" value="${step.durationMs}" min="500" step="500" style="font-size:12px;" /></div>
            <div style="flex:1;"><label style="font-size:11px;color:var(--muted);">Transition (ms)</label><input type="number" class="sd-trans" data-idx="${idx}" value="${step.transitionMs}" min="0" step="100" style="font-size:12px;" /></div>
          </div>
          ${step.type==='device_preset'?`
            <div><label style="font-size:11px;color:var(--muted);">Preset ID (1-250)</label><input type="number" class="sd-pid" data-idx="${idx}" value="${step.presetId||1}" min="1" max="250" style="font-size:12px;" /></div>
          `:`
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div><label style="font-size:11px;color:var(--muted);">Effect (fx)</label><select class="sd-fx" data-idx="${idx}" style="font-size:12px;">
                ${[{v:0,l:'Solid'},{v:1,l:'Blink'},{v:2,l:'Breathe'},{v:7,l:'Colorloop'},{v:9,l:'Rainbow'},{v:12,l:'Colortwinkles'},{v:13,l:'Running'},{v:38,l:'Chase'},{v:44,l:'Fireworks'},{v:47,l:'Strobe'},{v:63,l:'Pride 2015'},{v:65,l:'Colorwaves'},{v:66,l:'Lake'},{v:68,l:'BPM'},{v:69,l:'Juggle'},{v:70,l:'Palette'},{v:79,l:'Popcorn'},{v:80,l:'Drip'},{v:101,l:'Plasma'},{v:110,l:'Flow'}].map(f=>`<option value="${f.v}" ${(step.payload?.seg?.[0]?.fx===f.v)?'selected':''}>${f.l}</option>`).join('')}
              </select></div>
              <div><label style="font-size:11px;color:var(--muted);">Palette (pal)</label><select class="sd-pal" data-idx="${idx}" style="font-size:12px;">
                ${[{v:0,l:'Default'},{v:1,l:'Random'},{v:2,l:'Color 1'},{v:5,l:'Semi Blue'},{v:6,l:'Party'},{v:7,l:'Cloud'},{v:8,l:'Lava'},{v:9,l:'Ocean'},{v:10,l:'Forest'},{v:11,l:'Rainbow'},{v:35,l:'Fire'}].map(p=>`<option value="${p.v}" ${(step.payload?.seg?.[0]?.pal===p.v)?'selected':''}>${p.l}</option>`).join('')}
              </select></div>
            </div>
            <div><label style="font-size:11px;color:var(--muted);">Brightness</label><input type="range" class="sd-bri" data-idx="${idx}" min="0" max="255" value="${step.payload?.bri||200}" /></div>
            <div style="display:flex;gap:8px;">
              <div style="flex:1;"><label style="font-size:11px;color:var(--muted);">Speed</label><input type="range" class="sd-sx" data-idx="${idx}" min="0" max="255" value="${step.payload?.seg?.[0]?.sx||128}" /></div>
              <div style="flex:1;"><label style="font-size:11px;color:var(--muted);">Intensity</label><input type="range" class="sd-ix" data-idx="${idx}" min="0" max="255" value="${step.payload?.seg?.[0]?.ix||128}" /></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <div><label style="font-size:11px;color:var(--muted);">Primary</label><input type="color" class="sd-col1" data-idx="${idx}" value="${rgbToHex(step.payload?.seg?.[0]?.col?.[0])}" /></div>
              <div><label style="font-size:11px;color:var(--muted);">Secondary</label><input type="color" class="sd-col2" data-idx="${idx}" value="${rgbToHex(step.payload?.seg?.[0]?.col?.[1])}" /></div>
              <div><label style="font-size:11px;color:var(--muted);">Tertiary</label><input type="color" class="sd-col3" data-idx="${idx}" value="${rgbToHex(step.payload?.seg?.[0]?.col?.[2])}" /></div>
            </div>
          `}
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  // Expand/collapse
  list.querySelectorAll('.step-expand').forEach(btn => btn.addEventListener('click', () => {
    const det = list.querySelector('.step-details[data-idx="'+btn.dataset.idx+'"]');
    if (det) det.style.display = det.style.display==='none'?'block':'none';
    btn.textContent = det.style.display==='none'?'▼':'▲';
  }));

  // Delete step
  list.querySelectorAll('.step-del').forEach(btn => btn.addEventListener('click', () => {
    const pls = loadPlaylists();
    const p = pls.find(x=>x.id===editingPlaylistId);
    if (p) { p.steps.splice(parseInt(btn.dataset.idx),1); savePlaylists(pls); renderPlaylistSteps(p); }
  }));

  // Inline edits — label, duration, transition, presetId
  list.querySelectorAll('.sd-label').forEach(el => el.addEventListener('change', () => { updateStep(el.dataset.idx, s => s.label=el.value); }));
  list.querySelectorAll('.sd-dur').forEach(el => el.addEventListener('change', () => { updateStep(el.dataset.idx, s => s.durationMs=parseInt(el.value)||5000); }));
  list.querySelectorAll('.sd-trans').forEach(el => el.addEventListener('change', () => { updateStep(el.dataset.idx, s => s.transitionMs=parseInt(el.value)||700); }));
  list.querySelectorAll('.sd-pid').forEach(el => el.addEventListener('change', () => { updateStep(el.dataset.idx, s => s.presetId=parseInt(el.value)||1); }));

  // Effect edits
  list.querySelectorAll('.sd-fx').forEach(el => el.addEventListener('change', () => { updateStep(el.dataset.idx, s => { if(s.payload?.seg?.[0]) s.payload.seg[0].fx=parseInt(el.value); }); }));
  list.querySelectorAll('.sd-pal').forEach(el => el.addEventListener('change', () => { updateStep(el.dataset.idx, s => { if(s.payload?.seg?.[0]) s.payload.seg[0].pal=parseInt(el.value); }); }));
  list.querySelectorAll('.sd-bri').forEach(el => el.addEventListener('input', () => { updateStep(el.dataset.idx, s => { if(s.payload) s.payload.bri=parseInt(el.value); }); }));
  list.querySelectorAll('.sd-sx').forEach(el => el.addEventListener('input', () => { updateStep(el.dataset.idx, s => { if(s.payload?.seg?.[0]) s.payload.seg[0].sx=parseInt(el.value); }); }));
  list.querySelectorAll('.sd-ix').forEach(el => el.addEventListener('input', () => { updateStep(el.dataset.idx, s => { if(s.payload?.seg?.[0]) s.payload.seg[0].ix=parseInt(el.value); }); }));

  // Color pickers
  ['sd-col1','sd-col2','sd-col3'].forEach((cls, ci) => {
    list.querySelectorAll('.'+cls).forEach(el => el.addEventListener('input', () => {
      updateStep(el.dataset.idx, s => {
        if(s.payload?.seg?.[0]?.col) { const c = hexToRgb(el.value); s.payload.seg[0].col[ci] = [c.r,c.g,c.b,0]; }
      });
    }));
  });
}

function updateStep(idx, fn) {
  const pls = loadPlaylists();
  const p = pls.find(x=>x.id===editingPlaylistId);
  if (p && p.steps[idx]) { fn(p.steps[idx]); savePlaylists(pls); }
}

function rgbToHex(arr) {
  if (!arr||!arr.length) return '#000000';
  return '#'+[arr[0],arr[1],arr[2]].map(v=>(v||0).toString(16).padStart(2,'0')).join('');
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return {r,g,b};
}

// Save settings
document.getElementById('ple-save-settings-i3j4').addEventListener('click', () => {
  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (!pl) return;
  pl.name = document.getElementById('ple-name-w1x2').value;
  pl.description = document.getElementById('ple-desc-y3z4').value;
  pl.repeat = parseInt(document.getElementById('ple-repeat-a5b6').value)||0;
  pl.shuffle = document.getElementById('ple-shuffle-c7d8').checked;
  pl.endPresetId = parseInt(document.getElementById('ple-endpreset-e9f0').value)||0;
  const checked = document.querySelectorAll('.ple-tgt:checked');
  pl.targets = Array.from(checked).map(c=>c.value);
  if (!pl.targets.length) pl.targets = ['all'];
  savePlaylists(pls);
  showToast('Playlist settings saved','success');
  renderPlaylists();
});

// Step modal
document.getElementById('ple-add-step-k5l6').addEventListener('click', () => {
  document.getElementById('step-modal-q7r8').style.display = 'flex';
});
document.getElementById('close-step-modal-w3x4').addEventListener('click', () => {
  document.getElementById('step-modal-q7r8').style.display = 'none';
});
document.getElementById('add-preset-step-s9t0').addEventListener('click', () => {
  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (pl) {
    pl.steps.push({id:'s'+Date.now(), type:'device_preset', label:'New Preset Step', presetId:1, durationMs:5000, transitionMs:700, targetOverride:null});
    savePlaylists(pls); renderPlaylistSteps(pl);
  }
  document.getElementById('step-modal-q7r8').style.display = 'none';
});
document.getElementById('add-effect-step-u1v2').addEventListener('click', () => {
  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (pl) {
    pl.steps.push({id:'s'+Date.now(), type:'effect', label:'New Effect Step', durationMs:5000, transitionMs:700, targetOverride:null,
      payload:{on:true,bri:200,transition:7,seg:[{id:0,fx:0,pal:0,sx:128,ix:128,col:[[255,160,0,0],[0,0,0,0],[0,0,0,0]]}]}});
    savePlaylists(pls); renderPlaylistSteps(pl);
  }
  document.getElementById('step-modal-q7r8').style.display = 'none';
});

// === PLAYLIST ENGINE ===
const ENGINE = {
  playlist: null, stepIdx: 0, loopsLeft: 0,
  running: false, paused: false, abortCtl: null,
  stepStart: 0, stepDuration: 0, rafId: null,

  async play(pl) {
    this.stop();
    this.playlist = JSON.parse(JSON.stringify(pl));
    this.stepIdx = 0;
    this.loopsLeft = pl.repeat === 0 ? Infinity : pl.repeat;
    this.running = true; this.paused = false;
    this.abortCtl = new AbortController();
    playerLog('▶ Starting playlist: '+pl.name);
    try { await this._loop(); } catch(e) {}
    this.running = false;
    updatePlayerUI(null);
    updateDashPlaylist();
    renderPlaylists();
  },

  async _loop() {
    const pl = this.playlist;
    while (this.loopsLeft > 0 && this.running) {
      const steps = pl.shuffle ? [...pl.steps].sort(()=>Math.random()-0.5) : pl.steps;
      for (let i=0; i<steps.length; i++) {
        if (!this.running) return;
        this.stepIdx = i;
        const step = steps[i];
        updatePlayerUI(step, i, steps.length);
        updateDashPlaylist();
        renderPlayerSteps();
        await this._sendStep(step);
        playerLog('[Step '+(i+1)+'] '+step.label+' sent');
        try { await this._countdown(step.durationMs); } catch(e) { if (!this.running) return; this.abortCtl = new AbortController(); continue; }
      }
      if (pl.repeat !== 0) this.loopsLeft--;
      playerLog('Loop complete. Remaining: '+(this.loopsLeft===Infinity?'∞':this.loopsLeft));
    }
    if (pl.endPresetId > 0) {
      await sendToAllTargets(pl.targets, {ps: pl.endPresetId});
      playerLog('End preset #'+pl.endPresetId+' sent');
    }
    playerLog('⏹ Playlist finished');
  },

  async _sendStep(step) {
    const targets = resolveTargets(step.targetOverride || this.playlist.targets);
    const payload = step.type === 'device_preset'
      ? {ps: step.presetId, transition: Math.round(step.transitionMs/100)}
      : {...step.payload, transition: Math.round(step.transitionMs/100)};
    for (const dev of targets) { await wledPost(payload, dev.ip); }
  },

  _countdown(ms) {
    return new Promise((resolve, reject) => {
      const signal = this.abortCtl.signal;
      this.stepStart = Date.now(); this.stepDuration = ms;
      const tick = () => {
        if (signal.aborted) { reject('aborted'); return; }
        if (!this.running) { reject('stopped'); return; }
        if (this.paused) { this.rafId = requestAnimationFrame(tick); return; }
        const elapsed = Date.now() - this.stepStart;
        const pct = Math.min(100, (elapsed/ms)*100);
        const prog = document.getElementById('player-progress-i9j0');
        const cd = document.getElementById('player-countdown-k1l2');
        if (prog) prog.style.width = pct+'%';
        if (cd) cd.textContent = Math.max(0,((ms-elapsed)/1000)).toFixed(1)+'s remaining';
        if (elapsed >= ms) resolve();
        else this.rafId = requestAnimationFrame(tick);
      };
      signal.addEventListener('abort', () => reject('aborted'));
      this.rafId = requestAnimationFrame(tick);
    });
  },

  stop() {
    this.running=false;
    if (this.abortCtl) this.abortCtl.abort();
    cancelAnimationFrame(this.rafId);
    updatePlayerUI(null);
    updateDashPlaylist();
  },
  pause() { this.paused=true; },
  resume() { this.paused=false; this.stepStart=Date.now()-(this.stepDuration - (parseFloat(document.getElementById('player-countdown-k1l2')?.textContent||'0')*1000)); },
  next() { if (this.abortCtl) this.abortCtl.abort(); this.abortCtl = new AbortController(); },
  prev() { this.stepIdx=Math.max(0,this.stepIdx-2); if(this.abortCtl) this.abortCtl.abort(); this.abortCtl = new AbortController(); },
};

function resolveTargets(ids) {
  const d = loadDevices();
  const all = [...d.matrices, ...d.strings];
  if (!ids || ids.includes('all')) return all;
  return all.filter(x => ids.includes(x.id));
}

async function sendToAllTargets(targets, payload) {
  const devs = resolveTargets(targets);
  for (const dev of devs) { await wledPost(payload, dev.ip); }
}

function updatePlayerUI(step, idx, total) {
  const name = document.getElementById('player-pl-name-e5f6');
  const info = document.getElementById('player-step-info-g7h8');
  if (!step) {
    name.textContent = ENGINE.playlist ? ENGINE.playlist.name : '—';
    info.textContent = ENGINE.running ? 'Playing...' : 'Stopped';
    return;
  }
  name.textContent = ENGINE.playlist.name;
  info.textContent = 'Step '+(idx+1)+' of '+total+' — '+step.label;
}

function renderPlayerSteps() {
  const list = document.getElementById('player-step-list-m3n4');
  if (!ENGINE.playlist) { list.innerHTML = '<p style="font-size:12px;color:var(--muted);">No playlist loaded</p>'; return; }
  list.innerHTML = '';
  ENGINE.playlist.steps.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'mini-step';
    if (ENGINE.running && i === ENGINE.stepIdx) div.classList.add('current');
    else if (ENGINE.running && i < ENGINE.stepIdx) div.classList.add('done');
    div.innerHTML = `<span style="font-size:11px;font-weight:600;min-width:24px;">#${i+1}</span><span style="flex:1;font-size:12px;">${s.label}</span><span style="font-size:11px;color:var(--muted);">${(s.durationMs/1000).toFixed(1)}s</span>`;
    list.appendChild(div);
  });
}

function playerLog(msg) {
  const log = document.getElementById('player-log-o5p6');
  if (!log) return;
  const line = document.createElement('div');
  line.textContent = '['+new Date().toLocaleTimeString()+'] '+msg;
  line.style.color = 'var(--amber)';
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

// Transport controls
document.getElementById('tp-play-u5v6').addEventListener('click', () => {
  if (ENGINE.running && !ENGINE.paused) { ENGINE.pause(); document.getElementById('tp-play-u5v6').textContent='▶'; return; }
  if (ENGINE.running && ENGINE.paused) { ENGINE.resume(); document.getElementById('tp-play-u5v6').textContent='⏸'; return; }
  // Start first playlist or editing one
  const pls = loadPlaylists();
  const pl = editingPlaylistId ? pls.find(p=>p.id===editingPlaylistId) : pls[0];
  if (pl) {
    ENGINE.play(pl);
    document.getElementById('tp-play-u5v6').textContent='⏸';
    renderPlaylists();
  } else { showToast('No playlist to play','warn'); }
});
document.getElementById('tp-stop-s3t4').addEventListener('click', () => {
  ENGINE.stop();
  document.getElementById('tp-play-u5v6').textContent='▶';
  document.getElementById('player-progress-i9j0').style.width='0%';
  document.getElementById('player-countdown-k1l2').textContent='0.0s remaining';
  renderPlaylists(); renderPlayerSteps();
});
document.getElementById('tp-next-w7x8').addEventListener('click', () => ENGINE.next());
document.getElementById('tp-prev-q1r2').addEventListener('click', () => ENGINE.prev());
document.getElementById('tp-shuffle-y9z0').addEventListener('click', () => {
  if (ENGINE.playlist) { ENGINE.playlist.shuffle = !ENGINE.playlist.shuffle; showToast('Shuffle '+(ENGINE.playlist.shuffle?'ON':'OFF'),'info'); }
});
document.getElementById('tp-loop-a1b2').addEventListener('click', () => {
  if (ENGINE.playlist) {
    ENGINE.playlist.repeat = ENGINE.playlist.repeat===0 ? 1 : 0;
    ENGINE.loopsLeft = ENGINE.playlist.repeat===0 ? Infinity : ENGINE.playlist.repeat;
    showToast('Loop '+(ENGINE.playlist.repeat===0?'∞':'×'+ENGINE.playlist.repeat),'info');
  }
});

// === INIT ===

// ===========================
// SEGMENT DESIGNER
