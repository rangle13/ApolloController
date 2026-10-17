['b1l1-s5t6','b1l2-w9x0','b2l1-c5d6','b2l2-g9h0'].forEach(id => {
  const el = $('#' + id);
  if (!el.length) return;
  const countId = id.replace('b1l1-s5t6','b1l1-count-q3r4').replace('b1l2-w9x0','b1l2-count-u7v8').replace('b2l1-c5d6','b2l1-count-a3b4').replace('b2l2-g9h0','b2l2-count-e7f8');
  const countEl = $('#' + countId);
  if (countEl.length) el.on('input', () => { countEl.text(el.val().length + '/255'); });
});

let seqAbort = false;
const seqDelay = ms => new Promise(r => { const id = setTimeout(r, ms); if (seqAbort) clearTimeout(id); });

function timestamp() { return new Date().toLocaleTimeString(); }
function logSeqEntry(msg) {
  const log = $('#seq-log-s1t2');
  log.append($('<div>').text(msg).css('color', 'var(--amber)'));
  log.scrollTop(log[0].scrollHeight);
}

async function runSequence() {
  seqAbort = false;
  $('#seq-stop-m5n6').show();

  const steps = [
    {label:'Band 1 Line 1', text: $('#b1l1-s5t6').val(), band:1},
    {label:'Band 1 Line 2', text: $('#b1l2-w9x0').val(), delayMs: parseInt($('#b1delay-y1z2').val()), band:1},
    {label:'Band 2 Line 1', text: $('#b2l1-c5d6').val(), band:2},
    {label:'Band 2 Line 2', text: $('#b2l2-g9h0').val(), delayMs: parseInt($('#b2delay-i1j2').val()), band:2},
  ];

  for (let i=0; i<steps.length; i++) {
    if (seqAbort) break;
    const s = steps[i];
    $('#seq-progress-o7p8').css('width', ((i+1)/steps.length*100)+'%');
    $('#seq-step-label-q9r0').text('Step '+(i+1)+' of '+steps.length+' — '+s.label+'...');
    await wledPost({seg:[{id: s.band-1, n: s.text}]});
    logSeqEntry('['+timestamp()+'] '+s.label+' sent ✓');
    if (s.delayMs && i < steps.length-1) {
      await new Promise(r => {
        const tid = setTimeout(r, s.delayMs);
        const check = setInterval(() => { if (seqAbort) { clearTimeout(tid); clearInterval(check); r(); } }, 100);
      });
    }
  }
  $('#seq-progress-o7p8').css('width', seqAbort ? '0%' : '100%');
  $('#seq-step-label-q9r0').text(seqAbort ? 'Stopped' : 'Complete ✓');
  $('#seq-stop-m5n6').hide();
}

$('#seq-run-k3l4').on('click', runSequence);
$('#seq-stop-m5n6').on('click', () => { seqAbort = true; });

// === OVERLAY BUILDER ===
