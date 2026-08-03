const ORS_KEY_STORAGE = 'gms_ors_api_key';
const STRIDE_STORAGE = 'gms_stride_length';

const MIN_STEPS = 5000;
const MAX_STEPS = 20000;
const STEP_INCREMENT = 1000;

const state = {
  mode: 'walk',
  targetSteps: null,
  targetKm: null,
  strideLength: 0.76,
  userLatLng: null,
  map: null,
  userMarker: null,
  routeLayer: null,
};

const el = (id) => document.getElementById(id);

function initSettings() {
  const savedKey = localStorage.getItem(ORS_KEY_STORAGE) || '';
  const savedStride = parseFloat(localStorage.getItem(STRIDE_STORAGE));
  state.strideLength = Number.isFinite(savedStride) ? savedStride : 0.76;

  el('apiKeyInput').value = savedKey;
  el('strideInput').value = state.strideLength;

  el('settingsBtn').addEventListener('click', () => {
    el('settingsPanel').classList.toggle('hidden');
  });

  el('saveSettingsBtn').addEventListener('click', () => {
    const key = el('apiKeyInput').value.trim();
    const stride = parseFloat(el('strideInput').value);
    localStorage.setItem(ORS_KEY_STORAGE, key);
    if (Number.isFinite(stride) && stride > 0) {
      state.strideLength = stride;
      localStorage.setItem(STRIDE_STORAGE, String(stride));
    }
    el('settingsPanel').classList.add('hidden');
    updateGenerateAvailability();
  });

  if (!savedKey) {
    el('settingsPanel').classList.remove('hidden');
  }
}

function getApiKey() {
  return (localStorage.getItem(ORS_KEY_STORAGE) || '').trim();
}

function buildStepButtons() {
  const grid = el('stepButtonGrid');
  for (let steps = MIN_STEPS; steps <= MAX_STEPS; steps += STEP_INCREMENT) {
    const btn = document.createElement('button');
    btn.className = 'step-btn';
    btn.textContent = steps.toLocaleString();
    btn.addEventListener('click', () => {
      state.targetSteps = steps;
      [...grid.children].forEach((c) => c.classList.remove('selected'));
      btn.classList.add('selected');
      updateGenerateAvailability();
    });
    grid.appendChild(btn);
  }
}

function initKmSlider() {
  const slider = el('kmSlider');
  const valueLabel = el('kmValue');
  const setValue = () => {
    state.targetKm = parseInt(slider.value, 10);
    valueLabel.textContent = `${state.targetKm} km`;
  };
  slider.addEventListener('input', () => {
    setValue();
    updateGenerateAvailability();
  });
  setValue();
}

function initModeToggle() {
  const walkBtn = el('walkModeBtn');
  const cycleBtn = el('cycleModeBtn');

  const setMode = (mode) => {
    state.mode = mode;
    const isWalk = mode === 'walk';
    walkBtn.classList.toggle('active', isWalk);
    cycleBtn.classList.toggle('active', !isWalk);
    walkBtn.setAttribute('aria-selected', String(isWalk));
    cycleBtn.setAttribute('aria-selected', String(!isWalk));
    el('stepTargets').classList.toggle('hidden', !isWalk);
    el('kmTargets').classList.toggle('hidden', isWalk);
    el('statStepsRow').classList.toggle('hidden', !isWalk);
    hideResults();
    updateGenerateAvailability();
  };

  walkBtn.addEventListener('click', () => setMode('walk'));
  cycleBtn.addEventListener('click', () => setMode('cycle'));
}

function initMap() {
  state.map = L.map('map').setView([51.5074, -0.1278], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(state.map);
}

function initLocate() {
  el('locateBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      el('locateStatus').textContent = 'Geolocation not supported by this browser';
      return;
    }
    el('locateStatus').textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        el('locateStatus').textContent = `Located (±${Math.round(pos.coords.accuracy)}m)`;
        state.map.setView([state.userLatLng.lat, state.userLatLng.lng], 15);
        if (state.userMarker) state.map.removeLayer(state.userMarker);
        state.userMarker = L.marker([state.userLatLng.lat, state.userLatLng.lng]).addTo(state.map);
        updateGenerateAvailability();
      },
      (err) => {
        el('locateStatus').textContent = `Location error: ${err.message}`;
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

function updateGenerateAvailability() {
  const hasTarget = state.mode === 'walk' ? !!state.targetSteps : !!state.targetKm;
  const ready = hasTarget && !!state.userLatLng && !!getApiKey();
  el('generateBtn').disabled = !ready;
  if (!getApiKey()) {
    el('generateStatus').textContent = 'Add an OpenRouteService API key in settings first';
  } else if (!state.userLatLng) {
    el('generateStatus').textContent = 'Locate yourself first';
  } else if (!hasTarget) {
    el('generateStatus').textContent = state.mode === 'walk' ? 'Pick a step target' : 'Pick a ride distance';
  } else {
    el('generateStatus').textContent = '';
  }
}

function hideResults() {
  el('statsPanel').classList.add('hidden');
  el('navSection').classList.add('hidden');
  if (state.routeLayer) {
    state.map.removeLayer(state.routeLayer);
    state.routeLayer = null;
  }
}

function metersForTarget() {
  if (state.mode === 'walk') {
    return state.targetSteps * state.strideLength;
  }
  return state.targetKm * 1000;
}

async function generateRoute() {
  const apiKey = getApiKey();
  if (!apiKey || !state.userLatLng) return;

  const profile = state.mode === 'walk' ? 'foot-walking' : 'cycling-regular';
  const lengthMeters = Math.max(500, Math.round(metersForTarget()));

  const body = {
    coordinates: [[state.userLatLng.lng, state.userLatLng.lat]],
    options: {
      round_trip: {
        length: lengthMeters,
        points: 5,
        seed: Math.floor(Math.random() * 1_000_000),
      },
      ...(state.mode === 'walk' ? { avoid_features: ['steps'] } : {}),
    },
  };

  el('generateBtn').disabled = true;
  el('generateStatus').textContent = 'Generating route…';

  try {
    const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ORS request failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const geojson = await res.json();
    renderRoute(geojson);
  } catch (err) {
    el('generateStatus').textContent = `Error: ${err.message}`;
  } finally {
    updateGenerateAvailability();
  }
}

function renderRoute(geojson) {
  hideResults();

  const feature = geojson.features[0];
  const coords = feature.geometry.coordinates; // [lng, lat]
  const latLngs = coords.map(([lng, lat]) => [lat, lng]);

  state.routeLayer = L.polyline(latLngs, { color: '#16a34a', weight: 5 }).addTo(state.map);
  state.map.fitBounds(state.routeLayer.getBounds(), { padding: [24, 24] });

  const summary = feature.properties.summary;
  const distanceM = summary.distance;
  const durationS = summary.duration;

  el('statDistance').textContent =
    state.mode === 'walk' ? `${(distanceM / 1000).toFixed(2)} km` : `${(distanceM / 1000).toFixed(1)} km`;
  el('statTime').textContent = formatDuration(durationS);
  if (state.mode === 'walk') {
    el('statSteps').textContent = Math.round(distanceM / state.strideLength).toLocaleString();
  }
  el('statsPanel').classList.remove('hidden');

  buildNavLinks(latLngs);
  el('navSection').classList.remove('hidden');
}

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function sampleWaypoints(latLngs, maxPoints) {
  if (latLngs.length <= maxPoints) return latLngs.slice(1, -1);
  const interior = latLngs.slice(1, -1);
  const step = interior.length / maxPoints;
  const sampled = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(interior[Math.floor(i * step)]);
  }
  return sampled;
}

function haversineMeters([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function farthestPoint(latLngs, from) {
  let best = latLngs[0];
  let bestDist = -1;
  for (const point of latLngs) {
    const dist = haversineMeters(from, point);
    if (dist > bestDist) {
      bestDist = dist;
      best = point;
    }
  }
  return best;
}

function buildNavLinks(latLngs) {
  const start = latLngs[0];
  const waypoints = sampleWaypoints(latLngs, 8);
  const isCycle = state.mode === 'cycle';

  // Google Maps' `waypoints` param officially supports multi-stop routes, so it can draw the full loop.
  const googleWaypoints = waypoints.map(([lat, lng]) => `${lat},${lng}`).join('|');
  const googleUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${start[0]},${start[1]}` +
    `&destination=${start[0]},${start[1]}` +
    (googleWaypoints ? `&waypoints=${encodeURIComponent(googleWaypoints)}` : '') +
    `&travelmode=${isCycle ? 'bicycling' : 'walking'}`;

  // Apple Maps has no documented multi-stop URL support, so send it a single real destination
  // (the farthest point on the loop) rather than a broken chained-stops hack.
  const turnaround = farthestPoint(latLngs, start);
  const appleUrl =
    `https://maps.apple.com/?saddr=${start[0]},${start[1]}` +
    `&daddr=${turnaround[0]},${turnaround[1]}` +
    (isCycle ? '' : '&dirflg=w');

  el('googleMapsLink').href = googleUrl;
  el('appleMapsLink').href = appleUrl;
}

function init() {
  initSettings();
  buildStepButtons();
  initKmSlider();
  initModeToggle();
  initMap();
  initLocate();
  el('generateBtn').addEventListener('click', generateRoute);
  updateGenerateAvailability();
}

document.addEventListener('DOMContentLoaded', init);
