Summary
Added jQuery 3.7.1 via the official CDN in index.html, loaded before the page loader.
Converted frontend UI event handling and DOM updates to jQuery across app.js, dashboard.js, devices.js, 
devlog.js, loader.js, overlay.js, playlist.js, segments.js, and textdelay.js.
Preserved native browser APIs where they suit the job better, including canvas 
geometry, AbortSignal, and reliable script-load handling.
Updated the frontend dependency note in README.md.
Validation: all 10 frontend scripts pass node --check, 
git diff --check passes, and browser checks confirmed navigation and overlay/segment interactions.
