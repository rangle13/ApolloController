['b1l1-s5t6','b1l2-w9x0','b2l1-c5d6','b2l2-g9h0'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  const countId = id.replace('b1l1-s5t6','b1l1-count-q3r4').replace('b1l2-w9x0','b1l2-count-u7v8').replace('b2l1-c5d6','b2l1-count-a3b4').replace('b2l2-g9h0','b2l2-count-e7f8');
  const countEl = document.getElementById(countId);
  if (countEl) el.addEventListener('input', () => { countEl.textContent = el.value.length+'/255'; });
});

let seqAbort = false;
const seqDelay = ms => new Promise(r => { const id = setTimeout(r, ms); if (seqAbort) clearTimeout(id); });

function timestamp() { return new Date().toLocaleTimeString(); }
function logSeqEntry(msg) {
  const log = document.getElementById('seq-log-s1t2');
  const line = document.createElement('div'); line.textContent = msg; line.style.color='var(--amber)';
  log.appendChild(line); log.scrollTop = log.scrollHeight;
}

async function runSequence() {
  seqAbort = false;
  document.getElementById('seq-stop-m5n6').style.display = 'inline-block';
  const b1l1 = document.getElementById('b1l1-s5t6');
  const b1l2 = document.getElementById('b1l2-w9x0');
  const b1d = document.getElementById('b1delay-y1z2');
  const b2l1 = document.getElementById('b2l1-c5d6');
  const b2l2 = document.getElementById('b2l2-g9h0');
  const b2d = document.getElementById('b2delay-i1j2');

  const steps = [
    {label:'Band 1 Line 1', text: b1l1.value, band:1},
    {label:'Band 1 Line 2', text: b1l2.value, delayMs: parseInt(b1d.value), band:1},
    {label:'Band 2 Line 1', text: b2l1.value, band:2},
    {label:'Band 2 Line 2', text: b2l2.value, delayMs: parseInt(b2d.value), band:2},
  ];
  const prog = document.getElementById('seq-progress-o7p8');
  const stepLabel = document.getElementById('seq-step-label-q9r0');

  for (let i=0; i<steps.length; i++) {
    if (seqAbort) break;
    const s = steps[i];
    prog.style.width = ((i+1)/steps.length*100)+'%';
    stepLabel.textContent = 'Step '+(i+1)+' of '+steps.length+' — '+s.label+'...';
    await wledPost({seg:[{id: s.band-1, n: s.text}]});
    logSeqEntry('['+timestamp()+'] '+s.label+' sent ✓');
    if (s.delayMs && i < steps.length-1) {
      await new Promise(r => {
        const tid = setTimeout(r, s.delayMs);
        const check = setInterval(() => { if (seqAbort) { clearTimeout(tid); clearInterval(check); r(); } }, 100);
      });
    }
  }
  prog.style.width = seqAbort ? '0%' : '100%';
  stepLabel.textContent = seqAbort ? 'Stopped' : 'Complete ✓';
  document.getElementById('seq-stop-m5n6').style.display = 'none';
}

document.getElementById('seq-run-k3l4').addEventListener('click', runSequence);
document.getElementById('seq-stop-m5n6').addEventListener('click', () => { seqAbort = true; });

// === OVERLAY BUILDER ===
