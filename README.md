# GetMyStepsIn

Pick a step target (walking) or distance (cycling), locate yourself, and generate a random loop route that favours footpaths/quieter roads (walking) or cycle-friendly roads (cycling). Then hand the route off to Apple Maps or Google Maps for actual turn-by-turn navigation — including Apple Watch prompts and AirPods audio, which only the native map apps can do.

Static site: plain HTML/CSS/JS, [Leaflet](https://leafletjs.com/) + OpenStreetMap for the map, [OpenRouteService](https://openrouteservice.org/) for route generation. No backend, no build step. Hosted for free with **GitHub Pages** — no Netlify, no separate account, no separate domain needed.

## 1. Turn on GitHub Pages (one-time)

1. On this repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)**. Click **Save**.
4. GitHub gives you a live URL, typically `https://<your-username>.github.io/friendly-broccoli/`. It can take a minute or two to go live the first time, and re-deploys automatically on every push to `main` after that.

## 2. Get a free OpenRouteService API key

1. Go to https://openrouteservice.org/dev/#/signup and create a free account.
2. Once logged in, create a new API key (token) from your dashboard.
3. Open the deployed site, tap the ⚙️ settings icon, paste the key in, and hit Save. It's stored only in your browser (`localStorage`), never committed to this repo.

Free tier is 2,000 requests/day — miles more than enough for personal use.

## 3. Run it locally (optional)

No build tools needed. From the repo root:

```bash
python3 -m http.server 8080
# or: npx serve .
```

Then open http://localhost:8080. Note: browser geolocation requires `https://` or `localhost` — both work.

## Notes / limitations

- **Turn-by-turn on your Watch/AirPods is handled by Apple Maps or Google Maps, not this site.** A website can't control your Watch or push audio directly. This app's job is to build a good random route and open it in the native app, which already supports background/locked-screen navigation with Watch and AirPods.
- Apple Maps doesn't officially support deep-linking straight into cycling directions, so for cycling the app opens Apple Maps without forcing a mode — you may need to tap "Cycle" yourself. Google Maps handles this properly via `travelmode=bicycling`.
- Route "favouring footpaths / quiet roads" comes from OpenRouteService's `foot-walking` and `cycling-regular` routing profiles, which already weight OSM footways/cycleways over busy roads, plus `avoid_features: steps` for walking.
