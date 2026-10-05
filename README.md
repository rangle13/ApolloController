# Apollo M-1 WLED Controller

A modular Node.js web application for controlling WLED LED matrix devices.

## Project Structure

```
apollo-controller/
├── server.js              # Express server entry point
├── package.json
├── Dockerfile             # Multi-stage Docker build
├── docker-compose.yml     # Compose for VPS deployment
├── .env.example           # Environment variable template
└── public/                # All frontend assets (served statically)
    ├── index.html         # SPA shell — nav + all page divs
    ├── css/
    │   └── styles.css     # All custom CSS (dark theme, toggles, etc.)
    └── js/
        ├── app.js         # Global state, toast, WLED API, navigation, presets
        ├── dashboard.js   # Dashboard page events & controls
        ├── textdelay.js   # Text Delay page logic
        ├── overlay.js     # Overlay Builder — canvas, boxes, props panel
        ├── devices.js     # Device management (add/edit/delete matrices & strings)
        ├── playlist.js    # Playlist builder & player
        └── segments.js    # Segment Builder — canvas, zones, props panel
```

## Quick Start (Local)

```bash
npm install
npm start
# → http://localhost:3001
```

For development with auto-reload:
```bash
npm run dev
```

## Docker

### Build & run with Compose (recommended for VPS)

```bash
# 1. Copy and edit environment file
cp .env.example .env

# 2. Build and start
docker compose up -d --build

# 3. Check logs
docker compose logs -f

# 4. Stop
docker compose down
```

### Manual Docker build

```bash
docker build -t apollo-controller .
docker run -d --env-file .env -p 3000:3000 --name apollo apollo-controller
```

## VPS Deployment

1. SSH into your VPS
2. Install Docker + Docker Compose
3. Clone or copy this folder to the VPS
4. `cp .env.example .env` and set `PORT` if needed
5. `docker compose up -d --build`
6. Point your reverse proxy (nginx/Caddy) to `localhost:$PORT`

### Example Nginx config

```nginx
server {
    listen 80;
    server_name apollo.yourdomain.com;

    location / {
        proxy_pass http://localhost:$PORT$;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Adding a New Page

1. Add your page `<div id="page-newpage">` in `public/index.html`
2. Add a nav button with `data-page="newpage"` 
3. Create `public/js/newpage.js` with your page logic
4. Add `<script src="/js/newpage.js"></script>` at the bottom of `index.html`
5. That's it — the router in `app.js` handles showing/hiding pages automatically

## Health Check

`GET /health` → `{ "status": "ok", "ts": <timestamp> }`
