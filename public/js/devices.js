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

$(document).on('click', '.dev-ping', async function () {
  const button = $(this);
  const ip = button.data('ip');
  const pill = button.closest('.acard').find('.status-pill');
  try {
    await deviceFetch('http://' + ip + '/json/info');
    pill.html('<span class="status-dot" style="background:var(--success);"></span>Online');
  } catch (e) {
    pill.html('<span class="status-dot" style="background:var(--danger);"></span>Offline (CORS)');
  }
});

$(document).on('click', '.dev-del', function () {
  const button = $(this);
  if (!confirm('Delete this device?')) return;
  const d = loadDevices();
  if (button.data('type') === 'matrix') d.matrices = d.matrices.filter(m => m.id !== button.data('id'));
  else d.strings = d.strings.filter(s => s.id !== button.data('id'));
  if (d.activeId === button.data('id')) { d.activeId = null; d.activeType = null; }
  saveDevices(d);
  renderDevices();
});

$(document).on('click', '.dev-active', function () {
  const button = $(this);
  const d = loadDevices();
  const ip = button.data('ip');
  d.activeId = button.data('id');
  d.activeType = button.data('type');
  saveDevices(d);
  setActiveIp(ip);
  window.APP.matrixW = parseInt(button.attr('data-w')) || 64;
  window.APP.matrixH = parseInt(button.attr('data-h')) || 64;
  $('#ip-input-d1a2').val(ip);
  renderDevices();
  populateDeviceDropdown();
  showToast('Active device set: ' + ip, 'success');
});

function renderDevices() {
  const d = loadDevices();
  // Matrices
  const ml = $('#matrix-list-i1j2').empty();
  d.matrices.forEach(m => {
    const leds = m.width * m.height;
    const isActive = d.activeId === m.id && d.activeType === 'matrix';
    const card = $('<div>').addClass('acard').css('border-left', '3px solid var(--amber)');
    if (isActive) card.css({ outline: '2px solid var(--amber)', outlineOffset: '2px' });
    card.html(`
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
    `);
    ml.append(card);
  });

  // Strings
  const sl = $('#string-list-a9b0').empty();
  d.strings.forEach(s => {
    const isActive = d.activeId === s.id && d.activeType === 'string';
    const card = $('<div>').addClass('acard').css('border-left', '3px solid var(--indigo)');
    if (isActive) card.css({ outline: '2px solid var(--amber)', outlineOffset: '2px' });
    card.html(`
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
    `);
    sl.append(card);
  });

  // Active summary
  const summary = $('#active-dev-info-e3f4');
  const all = [...d.matrices.map(m=>({...m,type:'Matrix'})), ...d.strings.map(s=>({...s,type:'String',width:1,height:s.n}))];
  const active = all.find(x => x.id === d.activeId);
  if (active) {
    const w = active.width||1, h = active.height||active.n||0;
    summary.html(active.type+' · <strong>'+active.name+'</strong> · '+active.ip+' · '+w+'×'+h+' · <button class="abtn abtn-ghost abtn-sm" id="summary-go-dash" style="display:inline;">→ Dashboard</button>');
  } else {
    summary.text('No active device set');
  }
}

$(document).on('click', '#summary-go-dash', () => {
  const active = loadDevices();
  const device = [...active.matrices, ...active.strings].find(item => item.id === active.activeId);
  if (!device) return;
  setActiveIp(device.ip);
  $('#ip-input-d1a2').val(device.ip);
  showPage('dashboard');
});

// Add Matrix Form
$('#add-matrix-q3r4').on('click', () => $('#matrix-form-s5t6').show());
$('#mf-cancel-g9h0').on('click', () => $('#matrix-form-s5t6').hide());
$('#mf-save-e7f8').on('click', () => {
  const name = $('#mf-name-u7v8').val().trim();
  const ip = $('#mf-ip-w9x0').val().trim();
  if (!name||!ip) { showToast('Name and IP required','warn'); return; }
  const d = loadDevices();
  d.matrices.push({ id:'m'+Date.now(), name, ip, width:parseInt($('#mf-w-y1z2').val())||64, height:parseInt($('#mf-h-a3b4').val())||64, notes:$('#mf-notes-c5d6').val() });
  saveDevices(d);
  $('#matrix-form-s5t6').hide();
  $('#mf-name-u7v8, #mf-ip-w9x0, #mf-notes-c5d6').val('');
  renderDevices(); populateDeviceDropdown();
});

// Add String Form
$('#add-string-k3l4').on('click', () => $('#string-form-m5n6').show());
$('#sf-cancel-y7z8').on('click', () => $('#string-form-m5n6').hide());
$('#sf-save-w5x6').on('click', () => {
  const name = $('#sf-name-o7p8').val().trim();
  const ip = $('#sf-ip-q9r0').val().trim();
  if (!name||!ip) { showToast('Name and IP required','warn'); return; }
  const d = loadDevices();
  d.strings.push({ id:'s'+Date.now(), name, ip, n:parseInt($('#sf-len-s1t2').val())||300, notes:$('#sf-notes-u3v4').val() });
  saveDevices(d);
  $('#string-form-m5n6').hide();
  $('#sf-name-o7p8, #sf-ip-q9r0, #sf-notes-u3v4').val('');
  renderDevices(); populateDeviceDropdown();
});

// === PLAYLIST ===
