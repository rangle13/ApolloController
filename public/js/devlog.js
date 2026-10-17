// Logs every request/response exchanged with LED devices. Use deviceFetch() instead of fetch() for device calls.
const DEVLOG = {
    entries: [],
    max: 500,
    paused: false
};

function devLogPretty(text) {
    if (text == null || text === '') return '';
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch (_) {
        return String(text);
    }
}

function devLogAdd(entry) {
    if (DEVLOG.paused) return;
    DEVLOG.entries.push(entry);
    if (DEVLOG.entries.length > DEVLOG.max) DEVLOG.entries.shift();
    devLogRender();
}

async function deviceFetch(url, options = {}) {
    const started = performance.now();
    const entry = {
        ts: new Date(),
        method: (options.method || 'GET').toUpperCase(),
        url,
        request: typeof options.body === 'string' ? options.body : '',
        status: null,
        response: '',
        ms: 0,
        error: null,
    };
    try {
        const res = await fetch(url, options);
        entry.status = res.status;
        entry.response = await res.clone().text().catch(() => '');
        entry.ms = Math.round(performance.now() - started);
        devLogAdd(entry);
        return res;
    } catch (e) {
        entry.error = e.message || String(e);
        entry.ms = Math.round(performance.now() - started);
        devLogAdd(entry);
        throw e;
    }
}

function devLogRender() {
    const list = $('#devlog-list');
    if (!list.length) return;
    $('#devlog-count').text(DEVLOG.entries.length + ' entries');

    const node = list[0];
    const stick = node.scrollTop + node.clientHeight >= node.scrollHeight - 20;
    list.empty();
    DEVLOG.entries.forEach(en => {
        const d = $('<details>').addClass('devlog-entry');
        if (en.error || (en.status && en.status >= 400)) d.addClass('devlog-bad');
        const t = en.ts.toLocaleTimeString([], {
            hour12: false
        }) + '.' + String(en.ts.getMilliseconds()).padStart(3, '0');
        const result = en.error ? 'ERROR' : en.status;
        d.append($('<summary>').text(t + '  ' + en.method + ' ' + en.url + '  → ' + result + ' (' + en.ms + ' ms)'));
        const addBlock = (label, text) => {
            if (!text) return;
            d.append($('<div>').addClass('devlog-label').text(label));
            d.append($('<pre>').text(devLogPretty(text)));
        };
        addBlock('Sent', en.request);
        addBlock(en.error ? 'Error' : 'Received', en.error || en.response);
        list.append(d);
    });
    if (stick) list.scrollTop(node.scrollHeight);
}

function devLogEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function devLogAsHtml() {
    const rows = DEVLOG.entries.map(en => {
        const bad = en.error || (en.status && en.status >= 400);
        const head = en.ts.toISOString() + '  ' + en.method + ' ' + en.url + '  → ' + (en.error ? 'ERROR' : en.status) + ' (' + en.ms + ' ms)';
        const block = (label, text) => text ? '<div class="l">' + label + '</div><pre>' + devLogEsc(devLogPretty(text)) + '</pre>' : '';
        return '<details open class="' + (bad ? 'bad' : '') + '"><summary>' + devLogEsc(head) + '</summary>' +
            block('Sent', en.request) + block(en.error ? 'Error' : 'Received', en.error || en.response) + '</details>';
    }).join('\n');
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Apollo Device Log</title><style>' +
        'body{font-family:system-ui,sans-serif;background:#0f1117;color:#f1f5f9;margin:16px}h1{font-size:16px;color:#f59e0b}' +
        'details{border-bottom:1px solid #2a2d3a;padding:4px 0;font-family:monospace;font-size:12px}summary{cursor:pointer}' +
        '.bad summary{color:#ef4444}.l{color:#f59e0b;font-size:10px;text-transform:uppercase;margin:4px 0 2px}' +
        'pre{white-space:pre-wrap;word-break:break-all;margin:0 0 4px}button{background:#2a2d3a;color:#f1f5f9;border:1px solid #3a3d4a;border-radius:6px;padding:4px 10px;cursor:pointer;margin-bottom:8px}</style></head><body><h1>Apollo Device Log — ' +
        new Date().toLocaleString() + ' — ' + DEVLOG.entries.length + ' entries</h1>' +
        '<button id="t" onclick="var d=document.querySelectorAll(\'details\'),o=Array.from(d).some(function(x){return x.open});d.forEach(function(x){x.open=!o});this.textContent=o?\'Expand All\':\'Collapse All\'">Collapse All</button>' + rows + '</body></html>';
}

$('#devlog-collapse-btn').on('click', function () {
    const items = $('#devlog-list details');
    const open = items.toArray().some(d => d.open);
    items.prop('open', !open);
    $(this).text(open ? 'Expand All' : 'Collapse All');
});
$('#devlog-clear-btn').on('click', () => {
    DEVLOG.entries = [];
    devLogRender();
});
$('#devlog-pause').on('change', function () {
    DEVLOG.paused = $(this).prop('checked');
});
$('#devlog-download-btn').on('click', () => {
    const url = URL.createObjectURL(new Blob([devLogAsHtml()], {
        type: 'text/html'
    }));
    const a = $('<a>')
        .attr('href', url)
        .attr('download', 'device-log-' + new Date().toISOString().replace(/[:.]/g, '-') + '.html');
    a[0].click();
    URL.revokeObjectURL(url);
});