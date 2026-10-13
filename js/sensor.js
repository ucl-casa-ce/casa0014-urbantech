/**
 * CASA0014 Urban Tech Observatory
 * Sensor Detail Page Logic
 */

let allSensors = [];
let currentSensor = null;
let currentIndex = -1;
let detailMapInstance = null;

const CATEGORY_META = {
  'air-quality': { color: '#10b981', label: 'Air Quality' },
  'mobility': { color: '#f59e0b', label: 'Mobility & People' },
  'energy': { color: '#3b82f6', label: 'Energy & Utilities' },
  'weather': { color: '#06b6d4', label: 'Weather & Climate' },
  'default': { color: '#8b5cf6', label: 'Urban Sensor' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const sensorId = params.get('id') || 'marylebone-air-quality';
  await loadSensorDetail(sensorId);
  setupLightbox();
});

async function loadSensorDetail(sensorId) {
  try {
    const res = await fetch('data/sensors.json');
    if (!res.ok) throw new Error('Failed to fetch dataset');
    allSensors = await res.json();
    currentIndex = allSensors.findIndex(s => s.id === sensorId);
    if (currentIndex === -1) currentIndex = 0;
    currentSensor = allSensors[currentIndex];

    renderDetailPage(currentSensor);
    setupSensorNavigation(currentIndex, allSensors);
    initMiniMap(currentSensor.location?.lat, currentSensor.location?.lng, currentSensor);
  } catch (err) {
    console.error('Error loading sensor detail:', err);
    document.getElementById('detail-main-content').innerHTML = `
      <div style="padding: 4rem 1rem; text-align: center; color: var(--text-muted);">
        <h2>Unable to load sensor detail</h2>
        <p style="margin-top: 0.5rem;"><a href="index.html" style="color: var(--accent-cyan); text-decoration: underline;">Return to Urban Tech Observatory Map</a></p>
      </div>
    `;
  }
}

function renderDetailPage(sensor) {
  document.title = `${sensor.title} · CASA0014 Urban Tech`;

  const meta = CATEGORY_META[sensor.categorySlug] || CATEGORY_META.default;

  // Header Elements
  const categoryBadge = document.getElementById('detail-category-badge');
  if (categoryBadge) {
    categoryBadge.textContent = sensor.category;
    categoryBadge.style.color = meta.color;
    categoryBadge.style.borderColor = meta.color;
  }

  const titleEl = document.getElementById('detail-title');
  if (titleEl) titleEl.textContent = sensor.title;

  const authorEl = document.getElementById('detail-author');
  if (authorEl) authorEl.textContent = sensor.contributor?.name || 'Anonymous';

  const dateEl = document.getElementById('detail-date');
  if (dateEl) dateEl.textContent = sensor.contributor?.date || 'Undated';

  const cohortEl = document.getElementById('detail-cohort');
  if (cohortEl) cohortEl.textContent = sensor.contributor?.cohort ? `(${sensor.contributor.cohort})` : '';

  // Description / What is being sensed
  const descEl = document.getElementById('detail-description');
  if (descEl) descEl.textContent = sensor.description;

  // Parameters list
  const paramsContainer = document.getElementById('detail-parameters');
  if (paramsContainer && sensor.parameters) {
    paramsContainer.innerHTML = sensor.parameters.map(p => `
      <span class="param-tag">${p}</span>
    `).join('');
  }

  // Questions Box
  const questionsList = document.getElementById('detail-questions-list');
  if (questionsList && sensor.questions) {
    questionsList.innerHTML = sensor.questions.map(q => `
      <li>${q}</li>
    `).join('');
  }

  // Location Details
  const coordsVal = document.getElementById('detail-coords');
  if (coordsVal && sensor.location?.lat && sensor.location?.lng) {
    const coordString = `${sensor.location.lat.toFixed(6)}, ${sensor.location.lng.toFixed(6)}`;
    coordsVal.innerHTML = `
      <span>${coordString}</span>
      <button class="copy-btn" id="copy-coords-btn" onclick="copyToClipboard('${coordString}', 'Coordinates copied!')">Copy</button>
    `;
  }

  const addrVal = document.getElementById('detail-address');
  if (addrVal) addrVal.textContent = sensor.location?.address || 'Address not specified';

  const gmapsBtn = document.getElementById('detail-gmaps-link');
  if (gmapsBtn && sensor.location?.googleMapsUrl) {
    gmapsBtn.href = sensor.location.googleMapsUrl;
    gmapsBtn.style.display = 'inline-flex';
  } else if (gmapsBtn) {
    gmapsBtn.style.display = 'none';
  }

  const w3wContainer = document.getElementById('detail-w3w-container');
  if (w3wContainer && sensor.location?.what3words) {
    const cleanW3w = sensor.location.what3words.replace('///', '');
    w3wContainer.innerHTML = `
      <a class="w3w-badge" href="https://what3words.com/${cleanW3w}" target="_blank" rel="noopener noreferrer">
        <span style="color: var(--w3w-red); font-weight: 800;">///</span>
        <span>${cleanW3w}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    `;
  }

  // Photo
  const photoImg = document.getElementById('detail-photo');
  if (photoImg) {
    photoImg.src = sensor.image;
    photoImg.alt = sensor.title;
    photoImg.onclick = () => openLightbox(sensor.image);
  }

  const photoCaption = document.getElementById('detail-photo-caption');
  if (photoCaption) {
    photoCaption.textContent = `Field observation photograph · ${sensor.title}`;
  }
}

/**
 * Setup Next / Previous Observation Navigation
 */
function setupSensorNavigation(index, list) {
  if (!list || list.length === 0) return;
  const total = list.length;
  const prevIndex = (index - 1 + total) % total;
  const nextIndex = (index + 1) % total;
  const prevSensor = list[prevIndex];
  const nextSensor = list[nextIndex];

  // Top Nav Counter & Buttons
  const counterEl = document.getElementById('detail-nav-counter');
  if (counterEl) {
    counterEl.textContent = `Observation ${index + 1} of ${total}`;
  }

  const navPrevBtn = document.getElementById('nav-prev-btn');
  if (navPrevBtn && prevSensor) {
    navPrevBtn.href = `sensor.html?id=${prevSensor.id}`;
    navPrevBtn.title = `Previous: ${prevSensor.title} (← Left Arrow)`;
  }

  const navNextBtn = document.getElementById('nav-next-btn');
  if (navNextBtn && nextSensor) {
    navNextBtn.href = `sensor.html?id=${nextSensor.id}`;
    navNextBtn.title = `Next: ${nextSensor.title} (→ Right Arrow)`;
  }

  // Bottom Navigation Cards
  const bottomPrevBtn = document.getElementById('bottom-prev-btn');
  const bottomPrevTitle = document.getElementById('bottom-prev-title');
  if (bottomPrevBtn && prevSensor) {
    bottomPrevBtn.href = `sensor.html?id=${prevSensor.id}`;
    if (bottomPrevTitle) bottomPrevTitle.textContent = prevSensor.title;
  }

  const bottomNextBtn = document.getElementById('bottom-next-btn');
  const bottomNextTitle = document.getElementById('bottom-next-title');
  if (bottomNextBtn && nextSensor) {
    bottomNextBtn.href = `sensor.html?id=${nextSensor.id}`;
    if (bottomNextTitle) bottomNextTitle.textContent = nextSensor.title;
  }

  // Keyboard navigation (ArrowLeft = Prev, ArrowRight = Next)
  window._nextSensorUrl = `sensor.html?id=${nextSensor.id}`;
  window._prevSensorUrl = `sensor.html?id=${prevSensor.id}`;
  document.removeEventListener('keydown', handleKeyNavigation);
  document.addEventListener('keydown', handleKeyNavigation);
}

function handleKeyNavigation(e) {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight' && window._nextSensorUrl) {
    window.location.href = window._nextSensorUrl;
  } else if (e.key === 'ArrowLeft' && window._prevSensorUrl) {
    window.location.href = window._prevSensorUrl;
  }
}

/**
 * Initialize Mini Leaflet Map for Detail Page
 */
function initMiniMap(lat, lng, sensor) {
  const mapElement = document.getElementById('detail-map');
  if (!mapElement || !lat || !lng) return;

  if (detailMapInstance) {
    detailMapInstance.remove();
  }

  detailMapInstance = L.map('detail-map', {
    zoomControl: true,
    scrollWheelZoom: false
  }).setView([lat, lng], 16);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(detailMapInstance);

  const meta = CATEGORY_META[sensor.categorySlug] || CATEGORY_META.default;

  const markerIcon = L.divIcon({
    className: 'custom-leaflet-marker-wrapper',
    html: `
      <div class="custom-marker" style="background-color: ${meta.color}; width: 38px; height: 38px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19]
  });

  L.marker([lat, lng], { icon: markerIcon }).addTo(detailMapInstance);
}

/**
 * Lightbox Modal
 */
function setupLightbox() {
  const overlay = document.getElementById('lightbox-modal');
  const closeBtn = document.getElementById('lightbox-close');
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', () => overlay.classList.remove('active'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
}

function openLightbox(src) {
  const overlay = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  if (overlay && img) {
    img.src = src;
    overlay.classList.add('active');
  }
}

/**
 * Clipboard Copy Utility
 */
window.copyToClipboard = function (text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg || 'Copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy.');
  });
};

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
  setTimeout(() => toast.classList.remove('show'), 3000);
}
