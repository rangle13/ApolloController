// Injects HTML partials, then loads page scripts in order (they expect the DOM to exist).
$(function () {
    const PAGES = ['dashboard', 'textdelay', 'overlay', 'devices', 'playlist', 'segments', 'log'];
    const SCRIPTS = ['devlog', 'app', 'dashboard', 'textdelay', 'overlay', 'devices', 'playlist', 'segments'];

    const load = async (name) => {
        const res = await fetch('/partials/' + name + '.html');
        if (!res.ok) throw new Error('Failed to load partial ' + name + ': HTTP ' + res.status);
        return res.text();
    };

    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load ' + src));
        document.body.appendChild(script);
    });

    (async () => {
        const [nav, footer, ...pages] = await Promise.all(['navbar', 'footer', ...PAGES].map(load));
        $('#app-nav').html(nav);
        $('#app-pages').html(pages.join('\n'));
        $('#app-footer').html(footer);

        for (const name of SCRIPTS) await loadScript('/js/' + name + '.js');
    })().catch((e) => {
        console.error(e);
        $('body').prepend($('<p>').css({ color: '#ef4444', padding: '16px' }).text(e.message));
    });
});
