function loadDevices() {
  // Clear stale localStorage if it still has the old placeholder IP
  try {
    const stale = JSON.parse(localStorage.getItem('apollo_devices')||'{}');
    if (stale.matrices && stale.matrices[0] && stale.matrices[0].ip === '192.168.1.45') {
      localStorage.removeItem('apollo_devices');
    }
  } catch(_) {}
  const raw = localStorage.getItem('apollo_devices');
  if (raw) try { return JSON.parse(raw); } catch(e){}
  const def = {
    matrices:[{id:'m1',name:'M1',ip:'192.168.1.236',width:64,height:64,notes:''}],
    strings:[{id:'s1',name:'String-A',ip:'192.168.1.46',n:300,notes:''}],
    activeId:'m1', activeType:'matrix'
  };
  saveDevices(def);
  return def;
}
function saveDevices(d) { localStorage.setItem('apollo_devices', JSON.stringify(d)); }

let editingDeviceId = null;

function renderDevices() {
  const d = loadDevices();
  // Matrices
  const ml = document.getElementById('matrix-list-i1j2');
  ml.innerHTML = '';
  d.matrices.forEach(m => {
    const leds = m.width * m.height;
    const isActive = d.activeId === m.id && d.activeType === 'matrix';
    const card = document.createElement('div');
    card.className = 'acard';
    card.style.borderLeft = '3px solid var(--amber)';
    if (isActive) { card.style.outline = '2px solid var(--amber)'; card.style.outlineOffset = '2px'; }
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:6px;">
        <div>
          <p style="font-weight:700;font-size:14px;">${m.name}</p>
          <p style="font-size:12px;color:var(--muted);">${m.ip} · ${m.width} × ${m.height} · ${leds.toLocaleString()} LEDs</p>
        </div>
        <span class="status-pill" style="font-size:11px;"><span class="status-dot" style="background:var(--muted);"></span>Unknown</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        <button class="abtn abtn-ghost abtn-sm dev-ping" data-ip="${m.ip}">🔄 Ping</button>
        <button class="abtn abtn-ghost abtn-sm dev-del" data-id="${m.id}" data-type="matrix">🗑 Delete</button>
        <button class="abtn abtn-amber abtn-sm dev-active" data-id="${m.id}" data-type="matrix" data-w="${m.width}" data-h="${m.height}" data-ip="${m.ip}">${isActive?'✓ Active':'Set Active'}</button>
      </div>
    `;
    ml.appendChild(card);
  });

  // Strings
  const sl = document.getElementById('string-list-a9b0');
  sl.innerHTML = '';
  d.strings.forEach(s => {
    const isActive = d.activeId === s.id && d.activeType === 'string';
    const card = document.createElement('div');
    card.className = 'acard';
    card.style.borderLeft = '3px solid var(--indigo)';
    if (isActive) { card.style.outline = '2px solid var(--amber)'; card.style.outlineOffset = '2px'; }
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:6px;">
        <div>
          <p style="font-weight:700;font-size:14px;">${s.name}</p>
          <p style="font-size:12px;color:var(--muted);">${s.ip} · 1 × ${s.n} · ${s.n} LEDs</p>
        </div>
        <span class="status-pill" style="font-size:11px;"><span class="status-dot" style="background:var(--muted);"></span>Unknown</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        <button class="abtn abtn-ghost abtn-sm dev-ping" data-ip="${s.ip}">🔄 Ping</button>
        <button class="abtn abtn-ghost abtn-sm dev-del" data-id="${s.id}" data-type="string">🗑 Delete</button>
        <button class="abtn abtn-indigo abtn-sm dev-active" data-id="${s.id}" data-type="string" data-ip="${s.ip}" data-w="1" data-h="${s.n}">${isActive?'✓ Active':'Set Active'}</button>
      </div>
    `;
    sl.appendChild(card);
  });

  // Bind events
  document.querySelectorAll('.dev-ping').forEach(btn => btn.addEventListener('click', async () => {
    const ip = btn.dataset.ip;
    const pill = btn.closest('.acard').querySelector('.status-pill');
    try {
      await deviceFetch('http://'+ip+'/json/info');
      pill.innerHTML = '<span class="status-dot" style="background:var(--success);"></span>Online';
    } catch(e) {
      pill.innerHTML = '<span class="status-dot" style="background:var(--danger);"></span>Offline (CORS)';
    }
  }));

  document.querySelectorAll('.dev-del').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('Delete this device?')) return;
    const d2 = loadDevices();
    if (btn.dataset.type==='matrix') d2.matrices = d2.matrices.filter(m=>m.id!==btn.dataset.id);
    else d2.strings = d2.strings.filter(s=>s.id!==btn.dataset.id);
    if (d2.activeId === btn.dataset.id) { d2.activeId=null; d2.activeType=null; }
    saveDevices(d2); renderDevices();
  }));

  document.querySelectorAll('.dev-active').forEach(btn => btn.addEventListener('click', () => {
    const d2 = loadDevices();
    d2.activeId = btn.dataset.id; d2.activeType = btn.dataset.type;
    saveDevices(d2);
    setActiveIp(btn.dataset.ip);
    window.APP.matrixW = parseInt(btn.dataset.w)||64;
    window.APP.matrixH = parseInt(btn.dataset.h)||64;
    document.getElementById('ip-input-d1a2').value = btn.dataset.ip;
    renderDevices(); populateDeviceDropdown();
    showToast('Active device set: '+btn.dataset.ip, 'success');
  }));

  // Active summary
  const summary = document.getElementById('active-dev-info-e3f4');
  const all = [...d.matrices.map(m=>({...m,type:'Matrix'})), ...d.strings.map(s=>({...s,type:'String',width:1,height:s.n}))];
  const active = all.find(x => x.id === d.activeId);
  if (active) {
    const w = active.width||1, h = active.height||active.n||0;
    summary.innerHTML = active.type+' · <strong>'+active.name+'</strong> · '+active.ip+' · '+w+'×'+h+' · <button class="abtn abtn-ghost abtn-sm" id="summary-go-dash" style="display:inline;">→ Dashboard</button>';
    const goBtn = document.getElementById('summary-go-dash');
    if (goBtn) goBtn.addEventListener('click', () => { setActiveIp(active.ip); document.getElementById('ip-input-d1a2').value = active.ip; showPage('dashboard'); });
  } else {
    summary.textContent = 'No active device set';
  }
}

// Add Matrix Form
document.getElementById('add-matrix-q3r4').addEventListener('click', () => {
  document.getElementById('matrix-form-s5t6').style.display = 'block';
});
document.getElementById('mf-cancel-g9h0').addEventListener('click', () => {
  document.getElementById('matrix-form-s5t6').style.display = 'none';
});
document.getElementById('mf-save-e7f8').addEventListener('click', () => {
  const name = document.getElementById('mf-name-u7v8').value.trim();
  const ip = document.getElementById('mf-ip-w9x0').value.trim();
  if (!name||!ip) { showToast('Name and IP required','warn'); return; }
  const d = loadDevices();
  d.matrices.push({ id:'m'+Date.now(), name, ip, width:parseInt(document.getElementById('mf-w-y1z2').value)||64, height:parseInt(document.getElementById('mf-h-a3b4').value)||64, notes:document.getElementById('mf-notes-c5d6').value });
  saveDevices(d);
  document.getElementById('matrix-form-s5t6').style.display = 'none';
  document.getElementById('mf-name-u7v8').value=''; document.getElementById('mf-ip-w9x0').value=''; document.getElementById('mf-notes-c5d6').value='';
  renderDevices(); populateDeviceDropdown();
});

// Add String Form
document.getElementById('add-string-k3l4').addEventListener('click', () => {
  document.getElementById('string-form-m5n6').style.display = 'block';
});
document.getElementById('sf-cancel-y7z8').addEventListener('click', () => {
  document.getElementById('string-form-m5n6').style.display = 'none';
});
document.getElementById('sf-save-w5x6').addEventListener('click', () => {
  const name = document.getElementById('sf-name-o7p8').value.trim();
  const ip = document.getElementById('sf-ip-q9r0').value.trim();
  if (!name||!ip) { showToast('Name and IP required','warn'); return; }
  const d = loadDevices();
  d.strings.push({ id:'s'+Date.now(), name, ip, n:parseInt(document.getElementById('sf-len-s1t2').value)||300, notes:document.getElementById('sf-notes-u3v4').value });
  saveDevices(d);
  document.getElementById('string-form-m5n6').style.display = 'none';
  document.getElementById('sf-name-o7p8').value=''; document.getElementById('sf-ip-q9r0').value=''; document.getElementById('sf-notes-u3v4').value='';
  renderDevices(); populateDeviceDropdown();
});

// === PLAYLIST ===
