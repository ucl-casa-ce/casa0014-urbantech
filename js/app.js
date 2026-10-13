/**
 * CASA0014 Urban Tech Observatory
 * Master Landing Page Application Logic
 */

let allSensors = [];
let filteredSensors = [];
let currentCategory = 'all';
let currentSearchQuery = '';
let currentView = 'split'; // 'split', 'map', 'grid'
let mapInstance = null;
let markersLayer = null;
const sensorMarkers = new Map();

// Category Colors & SVG Icons
const CATEGORY_META = {
  'air-quality': {
    color: '#10b981',
    label: 'Air Quality',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`
  },
  'mobility': {
    color: '#f59e0b',
    label: 'Mobility & People',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`
  },
  'energy': {
    color: '#3b82f6',
    label: 'Energy & Utilities',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
  },
  'weather': {
    color: '#06b6d4',
    label: 'Weather & Climate',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><circle cx="12" cy="12" r="4"/></svg>`
  },
  'default': {
    color: '#8b5cf6',
    label: 'Urban Sensor',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>`
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  setupEventListeners();
  await loadSensors();
});

/**
 * Initialize Leaflet map
 */
function initMap() {
  const mapElement = document.getElementById('map-container');
  if (!mapElement) return;

  // Center on London (slightly east to frame both Marylebone and Olympic Park)
  mapInstance = L.map('map-container', {
    zoomControl: false,
    attributionControl: true
  }).setView([51.535, -0.08], 14);

  // OpenStreetMap Standard Tiles (free, no API key watermark)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapInstance);

  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
  markersLayer = L.layerGroup().addTo(mapInstance);
}

/**
 * Fetch sensor dataset
 */
async function loadSensors() {
  try {
    const res = await fetch('data/sensors.json');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    allSensors = await res.json();
    applyFilters();
  } catch (err) {
    console.error('Failed to load sensors dataset:', err);
    showToast('Failed to load sensor data.');
  }
}

/**
 * Apply category filter and search query
 */
function applyFilters() {
  filteredSensors = allSensors.filter(sensor => {
    // Category match
    const catMatch = (currentCategory === 'all') || (sensor.categorySlug === currentCategory);

    // Search match
    if (!currentSearchQuery) return catMatch;
    const query = currentSearchQuery.toLowerCase();
    const searchable = [
      sensor.title,
      sensor.description,
      sensor.category,
      sensor.location?.address,
      sensor.location?.area,
      sensor.contributor?.name,
      ...(sensor.parameters || []),
      ...(sensor.questions || [])
    ].join(' ').toLowerCase();

    return catMatch && searchable.includes(query);
  });

  renderMapMarkers();
  renderCards();
  updateCategoryCounts();
}

/**
 * Render Leaflet Map Markers
 */
function renderMapMarkers() {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  sensorMarkers.clear();

  if (filteredSensors.length === 0) return;

  const latLngs = [];

  filteredSensors.forEach(sensor => {
    if (!sensor.location?.lat || !sensor.location?.lng) return;

    const lat = sensor.location.lat;
    const lng = sensor.location.lng;
    latLngs.push([lat, lng]);

    const meta = CATEGORY_META[sensor.categorySlug] || CATEGORY_META.default;

    // Custom HTML Marker Pin
    const markerIcon = L.divIcon({
      className: 'custom-leaflet-marker-wrapper',
      html: `
        <div class="custom-marker" style="background-color: ${meta.color};" id="marker-${sensor.id}">
          ${meta.icon}
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20]
    });

    const marker = L.marker([lat, lng], { icon: markerIcon });

    // Popup Content Card
    const popupHtml = `
      <div class="map-popup-card">
        <img class="popup-img" src="${sensor.image}" alt="${sensor.title}" onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80'">
        <div class="popup-body">
          <div class="popup-badge" style="color: ${meta.color}">${sensor.category}</div>
          <div class="popup-title">${sensor.title}</div>
          <div class="popup-addr">${sensor.location.area || sensor.location.address}</div>
          <a class="popup-btn" href="sensor.html?id=${sensor.id}">View Observation →</a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.on('click', () => {
      highlightCard(sensor.id);
    });

    markersLayer.addLayer(marker);
    sensorMarkers.set(sensor.id, marker);
  });

  // Fit bounds if markers exist
  if (latLngs.length > 0 && mapInstance) {
    const bounds = L.latLngBounds(latLngs);
    mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }
}

/**
 * Render Cards in Stream / Grid
 */
function renderCards() {
  const container = document.getElementById('cards-container');
  if (!container) return;

  if (filteredSensors.length === 0) {
    container.innerHTML = `
      <div style="padding: 3rem 1rem; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; opacity: 0.5;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <p style="font-size: 1.1rem; font-weight: 600; color: #fff;">No sensor observations match your query.</p>
        <p style="font-size: 0.9rem; margin-top: 0.4rem;">Try resetting the category filter or searching for a different keyword.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredSensors.map(sensor => {
    const meta = CATEGORY_META[sensor.categorySlug] || CATEGORY_META.default;
    return `
      <article class="sensor-card" id="card-${sensor.id}" style="flex-shrink: 0; min-height: 380px;" onclick="handleCardClick('${sensor.id}', event)">
        <div class="card-media">
          <img class="card-img" src="${sensor.image}" alt="${sensor.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80'">
          <div class="card-badge">
            <span class="dot" style="background-color: ${meta.color}"></span>
            ${sensor.category}
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title">${sensor.title}</h3>
          <p class="card-desc">${sensor.description}</p>
          <div class="card-meta-list">
            <div class="card-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${sensor.location?.area || sensor.location?.address}</span>
            </div>
            ${sensor.location?.what3words ? `
              <div class="card-meta-item">
                <span style="color: var(--w3w-red); font-weight: 700;">///</span>
                <span style="font-family: var(--font-mono); font-size: 0.78rem;">${sensor.location.what3words.replace('///', '')}</span>
              </div>
            ` : ''}
          </div>
          <div class="card-footer">
            <span class="author-chip">By ${sensor.contributor?.name || 'Anonymous'} · ${sensor.contributor?.date || ''}</span>
            <a class="view-link" href="sensor.html?id=${sensor.id}">
              Explore
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

/**
 * Handle card click: center on map and open popup
 */
function handleCardClick(sensorId, event) {
  // If in grid view, navigate directly to sensor page
  if (currentView === 'grid') {
    window.location.href = `sensor.html?id=${sensorId}`;
    return;
  }

  // If user clicked the "Explore" link directly, let default link action proceed
  if (event?.target?.closest?.('.view-link')) return;

  const marker = sensorMarkers.get(sensorId);
  if (marker && mapInstance) {
    mapInstance.flyTo(marker.getLatLng(), 15, { duration: 0.8 });
    marker.openPopup();
  }
  highlightCard(sensorId);
}

/**
 * Highlight active card
 */
function highlightCard(sensorId) {
  document.querySelectorAll('.sensor-card').forEach(c => c.classList.remove('highlighted'));
  const card = document.getElementById(`card-${sensorId}`);
  if (card) {
    card.classList.add('highlighted');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/**
 * Update Category Count Badges
 */
function updateCategoryCounts() {
  document.querySelectorAll('.filter-pill').forEach(pill => {
    const cat = pill.dataset.category;
    let count = 0;
    if (cat === 'all') {
      count = allSensors.length;
    } else {
      count = allSensors.filter(s => s.categorySlug === cat).length;
    }
    const countSpan = pill.querySelector('.cat-count');
    if (countSpan) countSpan.textContent = `(${count})`;
  });
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
  // Live Search Input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      applyFilters();
    });
  }

  // Category Pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.category;
      applyFilters();
    });
  });

  // View Switchers
  const splitBtn = document.getElementById('view-split-btn');
  const mapBtn = document.getElementById('view-map-btn');
  const gridBtn = document.getElementById('view-grid-btn');
  const mainView = document.getElementById('main-view-container');
  const mapPanel = document.getElementById('map-panel-wrapper');
  const cardsContainer = document.getElementById('cards-container');

  function updateViewLayout(view) {
    currentView = view;
    [splitBtn, mapBtn, gridBtn].forEach(b => b?.classList.remove('active'));

    if (view === 'split') {
      splitBtn?.classList.add('active');
      mainView.className = 'main-container view-split';
      mapPanel.style.display = 'block';
      cardsContainer.style.display = '';
      cardsContainer.className = 'cards-stream';
    } else if (view === 'map') {
      mapBtn?.classList.add('active');
      mainView.className = 'main-container view-map-only';
      mapPanel.style.display = 'block';
      cardsContainer.style.display = 'none';
    } else if (view === 'grid') {
      gridBtn?.classList.add('active');
      mainView.className = 'main-container view-grid-only';
      mapPanel.style.display = 'none';
      cardsContainer.style.display = '';
      cardsContainer.className = 'cards-grid';
    }

    if (mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 200);
    }
  }

  splitBtn?.addEventListener('click', () => updateViewLayout('split'));
  mapBtn?.addEventListener('click', () => updateViewLayout('map'));
  gridBtn?.addEventListener('click', () => updateViewLayout('grid'));
}

/**
 * Toast Notification Utility
 */
function showToast(message) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}
