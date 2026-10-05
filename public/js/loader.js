// Injects HTML partials, then loads page scripts in order (they expect the DOM to exist).
(async function () {
    const PAGES = ['dashboard', 'textdelay', 'overlay', 'devices', 'playlist', 'segments', 'log'];
    const SCRIPTS = ['devlog', 'app', 'dashboard', 'textdelay', 'overlay', 'devices', 'playlist', 'segments'];

    const load = async (name) => {
        const res = await fetch('/partials/' + name + '.html');
        if (!res.ok) throw new Error('Failed to load partial ' + name + ': HTTP ' + res.status);
        return res.text();
    };

    const loadScript = (src) => new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.body.appendChild(s);
    });

    if (document.readyState === 'loading') {
        await new Promise((r) => document.addEventListener('DOMContentLoaded', r, {
            once: true
        }));
    }

    const [nav, footer, ...pages] = await Promise.all(['navbar', 'footer', ...PAGES].map(load));
    document.getElementById('app-nav').innerHTML = nav;
    document.getElementById('app-pages').innerHTML = pages.join('\n');
    document.getElementById('app-footer').innerHTML = footer;

    for (const name of SCRIPTS) await loadScript('/js/' + name + '.js');
})().catch((e) => {
    console.error(e);
    document.body.insertAdjacentHTML('afterbegin', '<p style="color:#ef4444;padding:16px;">' + e.message + '</p>');
});