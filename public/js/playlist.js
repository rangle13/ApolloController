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
$('#pl-tab-editor-m1n2').on('click', () => {
  plEditorTab='editor';
  $('#pl-editor-q5r6').show();
  $('#pl-player-o9p0').hide();
  $('#pl-tab-editor-m1n2').addClass('active');
  $('#pl-tab-player-o3p4').removeClass('active');
});
$('#pl-tab-player-o3p4').on('click', () => {
  plEditorTab='player';
  $('#pl-editor-q5r6').hide();
  $('#pl-player-o9p0').show();
  $('#pl-tab-editor-m1n2').removeClass('active');
  $('#pl-tab-player-o3p4').addClass('active');
  renderPlayerSteps();
});

$('#pl-filter-toggle-r7s8').on('click', () => {
  plFilterByDevice = !plFilterByDevice;
  renderPlaylists();
});

function renderPlaylists() {
  const allPls = loadPlaylists();
  const lib = $('#playlist-library-i7j8');
  const empty = $('#pl-empty-state-k9l0');
  const filterLabel = $('#pl-filter-label-p5q6');
  const filterToggle = $('#pl-filter-toggle-r7s8');

  const ip = window.APP && window.APP.ip;
  const activeDevice = getActiveDeviceForIp(ip);
  const pls = plFilterByDevice
    ? allPls.filter(pl => pl.targets.includes('all') || (activeDevice && pl.targets.includes(activeDevice.id)))
    : allPls;

  if (filterToggle.length) filterToggle.text(plFilterByDevice ? 'Show all playlists' : 'Filter by device');
  if (filterLabel.length) {
    if (!plFilterByDevice) {
      filterLabel.text('Showing: all playlists (' + allPls.length + ')');
    } else if (activeDevice) {
      filterLabel.text('Showing: playlists for ' + activeDevice.name + ' (' + activeDevice.ip + ')');
    } else if (ip) {
      filterLabel.text('Showing: "all devices" playlists (' + ip + ' is not a saved device)');
    } else {
      filterLabel.text('Showing: "all devices" playlists (not connected)');
    }
  }

  lib.children().not(empty).remove();
  empty.hide();
  if (pls.length === 0) {
    const emptyMsg = empty.find('p');
    if (emptyMsg.length) {
      emptyMsg.text((plFilterByDevice && allPls.length)
        ? 'No playlists assigned to this device yet'
        : 'No playlists yet');
    }
    empty.show();
    return;
  }

  pls.forEach(pl => {
    const isPlaying = ENGINE.running && ENGINE.playlist && ENGINE.playlist.id === pl.id;
    const card = $('<div>').addClass('acard pl-card');
    if (isPlaying) card.addClass('playlist-playing').css('border-left', '3px solid var(--amber)');
    if (pl.id === editingPlaylistId) card.addClass('pl-card-active');
    card.html(`
      <div class="pl-card-head">
        <span class="pl-card-name">${pl.name}</span>
        <span class="pl-chip">${pl.steps.length} steps</span>
        <span class="pl-chip">${pl.repeat===0?'∞':'×'+pl.repeat}</span>
        ${pl.shuffle?'<span class="pl-chip">🔀</span>':''}
      </div>
      ${pl.description ? `<p class="pl-card-desc">${pl.description}</p>` : ''}
      <div class="pl-card-btns">
        <button class="abtn abtn-amber abtn-sm pl-quick-play" data-plid="${pl.id}" title="Play">▶</button>
        <button class="abtn abtn-ghost abtn-sm pl-edit" data-plid="${pl.id}">✎ Edit</button>
        <button class="abtn abtn-ghost abtn-sm pl-dup" data-plid="${pl.id}">Copy</button>
        <button class="abtn abtn-danger abtn-sm pl-del" data-plid="${pl.id}">Delete</button>
      </div>
    `);
    lib.append(card);
  });
}

$(document).on('click', '.pl-quick-play', function () {
  const pl = loadPlaylists().find(p => p.id === $(this).data('plid'));
  if (pl) { ENGINE.play(pl); showToast('Playing: ' + pl.name, 'success'); renderPlaylists(); updateDashPlaylist(); }
});
$(document).on('click', '.pl-edit', function () {
  editingPlaylistId = $(this).data('plid');
  renderPlaylistEditor();
  renderPlaylists();
});
$(document).on('click', '.pl-dup', function () {
  const pls = loadPlaylists();
  const src = pls.find(p => p.id === $(this).data('plid'));
  if (!src) return;
  const dup = JSON.parse(JSON.stringify(src));
  dup.id = 'pl' + Date.now(); dup.name += ' (copy)';
  dup.steps.forEach(s => s.id = 's' + Date.now() + Math.random().toString(36).slice(2, 5));
  pls.push(dup); savePlaylists(pls); renderPlaylists();
});
$(document).on('click', '.pl-del', function () {
  const id = $(this).data('plid');
  if (!confirm('Delete this playlist?')) return;
  const pls = loadPlaylists().filter(p => p.id !== id);
  savePlaylists(pls);
  if (editingPlaylistId === id) { editingPlaylistId = null; renderPlaylistEditor(); }
  renderPlaylists();
});

// New playlist
$('#new-playlist-g5h6').on('click', () => {
  const pls = loadPlaylists();
  const np = { id:'pl'+Date.now(), name:'New Playlist', description:'', targets:['all'], repeat:0, shuffle:false, endPresetId:0, steps:[] };
  pls.push(np); savePlaylists(pls);
  editingPlaylistId = np.id;
  renderPlaylists(); renderPlaylistEditor();
});

function renderPlaylistEditor() {
  const noEdit = $('#pl-no-edit-s7t8');
  const form = $('#pl-edit-form-u9v0');
  if (!editingPlaylistId) { noEdit.show(); form.hide(); return; }
  noEdit.hide(); form.show();

  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (!pl) return;

  $('#ple-name-w1x2').val(pl.name);
  $('#ple-desc-y3z4').val(pl.description||'');
  $('#ple-repeat-a5b6').val(pl.repeat);
  $('#ple-shuffle-c7d8').prop('checked', pl.shuffle);
  $('#ple-endpreset-e9f0').val(pl.endPresetId||0);

  // Targets
  const tDiv = $('#ple-targets-g1h2').empty();
  const d = loadDevices();
  const allDevs = [...d.matrices, ...d.strings];
  const allCb = $('<label>')
    .css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' })
    .html('<input type="checkbox" class="ple-tgt" value="all" style="width:auto;" '+(pl.targets.includes('all')?'checked':'')+' /> All Devices');
  tDiv.append(allCb);
  allDevs.forEach(dev => {
    const lb = $('<label>')
      .css({ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' })
      .html('<input type="checkbox" class="ple-tgt" value="'+dev.id+'" style="width:auto;" '+(pl.targets.includes(dev.id)?'checked':'')+' /> '+dev.name);
    tDiv.append(lb);
  });

  // Steps
  renderPlaylistSteps(pl);
}

function renderPlaylistSteps(pl) {
  const list = $('#ple-step-list-m7n8').empty();
  if (!pl.steps.length) {
    list.html('<p style="font-size:12px;color:var(--muted);text-align:center;padding:16px;">No steps yet</p>');
    return;
  }
  pl.steps.forEach((step, idx) => {
    const card = $('<div>').addClass('step-card');
    const typeColor = step.type==='device_preset'?'var(--amber)':'var(--indigo)';
    const typeLabel = step.type==='device_preset'?'PRESET':'EFFECT';
    card.html(`
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
    `);
    list.append(card);
  });

  // Expand/collapse
  list.find('.step-expand').on('click', function () {
    const det = list.find('.step-details[data-idx="' + $(this).data('idx') + '"]');
    if (!det.length) return;
    det.toggle();
    $(this).text(det.is(':visible') ? '▲' : '▼');
  });

  // Delete step
  list.find('.step-del').on('click', function () {
    const pls = loadPlaylists();
    const p = pls.find(x=>x.id===editingPlaylistId);
    if (p) { p.steps.splice(parseInt($(this).data('idx')),1); savePlaylists(pls); renderPlaylistSteps(p); }
  });

  // Inline edits — label, duration, transition, presetId
  list.find('.sd-label').on('change', function () { updateStep($(this).data('idx'), s => s.label=$(this).val()); });
  list.find('.sd-dur').on('change', function () { updateStep($(this).data('idx'), s => s.durationMs=parseInt($(this).val())||5000); });
  list.find('.sd-trans').on('change', function () { updateStep($(this).data('idx'), s => s.transitionMs=parseInt($(this).val())||700); });
  list.find('.sd-pid').on('change', function () { updateStep($(this).data('idx'), s => s.presetId=parseInt($(this).val())||1); });

  // Effect edits
  list.find('.sd-fx').on('change', function () { updateStep($(this).data('idx'), s => { if(s.payload?.seg?.[0]) s.payload.seg[0].fx=parseInt($(this).val()); }); });
  list.find('.sd-pal').on('change', function () { updateStep($(this).data('idx'), s => { if(s.payload?.seg?.[0]) s.payload.seg[0].pal=parseInt($(this).val()); }); });
  list.find('.sd-bri').on('input', function () { updateStep($(this).data('idx'), s => { if(s.payload) s.payload.bri=parseInt($(this).val()); }); });
  list.find('.sd-sx').on('input', function () { updateStep($(this).data('idx'), s => { if(s.payload?.seg?.[0]) s.payload.seg[0].sx=parseInt($(this).val()); }); });
  list.find('.sd-ix').on('input', function () { updateStep($(this).data('idx'), s => { if(s.payload?.seg?.[0]) s.payload.seg[0].ix=parseInt($(this).val()); }); });

  // Color pickers
  ['sd-col1','sd-col2','sd-col3'].forEach((cls, ci) => {
    list.find('.'+cls).on('input', function () {
      updateStep($(this).data('idx'), s => {
        if(s.payload?.seg?.[0]?.col) { const c = hexToRgb($(this).val()); s.payload.seg[0].col[ci] = [c.r,c.g,c.b,0]; }
      });
    });
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
$('#ple-save-settings-i3j4').on('click', () => {
  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (!pl) return;
  pl.name = $('#ple-name-w1x2').val();
  pl.description = $('#ple-desc-y3z4').val();
  pl.repeat = parseInt($('#ple-repeat-a5b6').val())||0;
  pl.shuffle = $('#ple-shuffle-c7d8').prop('checked');
  pl.endPresetId = parseInt($('#ple-endpreset-e9f0').val())||0;
  pl.targets = $('.ple-tgt:checked').map((_, c) => c.value).get();
  if (!pl.targets.length) pl.targets = ['all'];
  savePlaylists(pls);
  showToast('Playlist settings saved','success');
  renderPlaylists();
});

// Step modal
$('#ple-add-step-k5l6').on('click', () => $('#step-modal-q7r8').css('display', 'flex'));
$('#close-step-modal-w3x4').on('click', () => $('#step-modal-q7r8').hide());
$('#add-preset-step-s9t0').on('click', () => {
  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (pl) {
    pl.steps.push({id:'s'+Date.now(), type:'device_preset', label:'New Preset Step', presetId:1, durationMs:5000, transitionMs:700, targetOverride:null});
    savePlaylists(pls); renderPlaylistSteps(pl);
  }
  $('#step-modal-q7r8').hide();
});
$('#add-effect-step-u1v2').on('click', () => {
  const pls = loadPlaylists();
  const pl = pls.find(p=>p.id===editingPlaylistId);
  if (pl) {
    pl.steps.push({id:'s'+Date.now(), type:'effect', label:'New Effect Step', durationMs:5000, transitionMs:700, targetOverride:null,
      payload:{on:true,bri:200,transition:7,seg:[{id:0,fx:0,pal:0,sx:128,ix:128,col:[[255,160,0,0],[0,0,0,0],[0,0,0,0]]}]}});
    savePlaylists(pls); renderPlaylistSteps(pl);
  }
  $('#step-modal-q7r8').hide();
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
        $('#player-progress-i9j0').css('width', pct+'%');
        $('#player-countdown-k1l2').text(Math.max(0,((ms-elapsed)/1000)).toFixed(1)+'s remaining');
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
  resume() { this.paused=false; this.stepStart=Date.now()-(this.stepDuration - (parseFloat($('#player-countdown-k1l2').text()||'0')*1000)); },
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
  const name = $('#player-pl-name-e5f6');
  const info = $('#player-step-info-g7h8');
  if (!step) {
    name.text(ENGINE.playlist ? ENGINE.playlist.name : '—');
    info.text(ENGINE.running ? 'Playing...' : 'Stopped');
    return;
  }
  name.text(ENGINE.playlist.name);
  info.text('Step '+(idx+1)+' of '+total+' — '+step.label);
}

function renderPlayerSteps() {
  const list = $('#player-step-list-m3n4').empty();
  if (!ENGINE.playlist) { list.html('<p style="font-size:12px;color:var(--muted);">No playlist loaded</p>'); return; }
  ENGINE.playlist.steps.forEach((s, i) => {
    const div = $('<div>').addClass('mini-step');
    if (ENGINE.running && i === ENGINE.stepIdx) div.addClass('current');
    else if (ENGINE.running && i < ENGINE.stepIdx) div.addClass('done');
    div.html(`<span style="font-size:11px;font-weight:600;min-width:24px;">#${i+1}</span><span style="flex:1;font-size:12px;">${s.label}</span><span style="font-size:11px;color:var(--muted);">${(s.durationMs/1000).toFixed(1)}s</span>`);
    list.append(div);
  });
}

function playerLog(msg) {
  const log = $('#player-log-o5p6');
  if (!log.length) return;
  const line = $('<div>').text('['+new Date().toLocaleTimeString()+'] '+msg).css('color', 'var(--amber)');
  log.append(line);
  log.scrollTop(log[0].scrollHeight);
}

// Transport controls
$('#tp-play-u5v6').on('click', () => {
  if (ENGINE.running && !ENGINE.paused) { ENGINE.pause(); $('#tp-play-u5v6').text('▶'); return; }
  if (ENGINE.running && ENGINE.paused) { ENGINE.resume(); $('#tp-play-u5v6').text('⏸'); return; }
  // Start first playlist or editing one
  const pls = loadPlaylists();
  const pl = editingPlaylistId ? pls.find(p=>p.id===editingPlaylistId) : pls[0];
  if (pl) {
    ENGINE.play(pl);
    $('#tp-play-u5v6').text('⏸');
    renderPlaylists();
  } else { showToast('No playlist to play','warn'); }
});
$('#tp-stop-s3t4').on('click', () => {
  ENGINE.stop();
  $('#tp-play-u5v6').text('▶');
  $('#player-progress-i9j0').css('width', '0%');
  $('#player-countdown-k1l2').text('0.0s remaining');
  renderPlaylists(); renderPlayerSteps();
});
$('#tp-next-w7x8').on('click', () => ENGINE.next());
$('#tp-prev-q1r2').on('click', () => ENGINE.prev());
$('#tp-shuffle-y9z0').on('click', () => {
  if (ENGINE.playlist) { ENGINE.playlist.shuffle = !ENGINE.playlist.shuffle; showToast('Shuffle '+(ENGINE.playlist.shuffle?'ON':'OFF'),'info'); }
});
$('#tp-loop-a1b2').on('click', () => {
  if (ENGINE.playlist) {
    ENGINE.playlist.repeat = ENGINE.playlist.repeat===0 ? 1 : 0;
    ENGINE.loopsLeft = ENGINE.playlist.repeat===0 ? Infinity : ENGINE.playlist.repeat;
    showToast('Loop '+(ENGINE.playlist.repeat===0?'∞':'×'+ENGINE.playlist.repeat),'info');
  }
});

// === INIT ===

// ===========================
// SEGMENT DESIGNER
