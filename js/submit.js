/**
 * CASA0014 Urban Tech Observatory
 * Interactive Submission Form Controller (Option A)
 */

let pickerMap = null;
let pickerMarker = null;
let uploadedPhotoDataUrl = null;
let uploadedFileName = '';

document.addEventListener('DOMContentLoaded', () => {
  initPickerMap();
  setupFormEventListeners();
});

/**
 * Initialize Leaflet Location Picker Map
 */
function initPickerMap() {
  const mapEl = document.getElementById('picker-map');
  if (!mapEl) return;

  // Default to London center
  const defaultLat = 51.5225;
  const defaultLng = -0.1550;

  pickerMap = L.map('picker-map', {
    zoomControl: true
  }).setView([defaultLat, defaultLng], 13);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(pickerMap);

  // Map Click Listener
  pickerMap.on('click', async (e) => {
    setMarkerLocation(e.latlng.lat, e.latlng.lng, true);
  });
}

/**
 * Set marker position and auto-populate location fields
 */
async function setMarkerLocation(lat, lng, shouldReverseGeocode = false) {
  if (!pickerMap) return;

  if (!pickerMarker) {
    const icon = L.divIcon({
      className: 'custom-leaflet-marker-wrapper',
      html: `
        <div class="custom-marker" style="background-color: var(--accent-cyan); width: 34px; height: 34px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/></svg>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    pickerMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(pickerMap);
    pickerMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      setMarkerLocation(pos.lat, pos.lng, true);
    });
  } else {
    pickerMarker.setLatLng([lat, lng]);
  }

  // Update Input Fields
  const latInput = document.getElementById('input-lat');
  const lngInput = document.getElementById('input-lng');
  const gmapsInput = document.getElementById('input-gmaps');

  if (latInput) latInput.value = lat.toFixed(6);
  if (lngInput) lngInput.value = lng.toFixed(6);
  if (gmapsInput) gmapsInput.value = `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

  // Reverse Geocoding via Nominatim API
  if (shouldReverseGeocode) {
    const addrInput = document.getElementById('input-address');
    if (addrInput) {
      addrInput.placeholder = 'Fetching street address...';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            addrInput.value = data.display_name;
          }
        }
      } catch (err) {
        console.warn('Reverse geocode error:', err);
      } finally {
        addrInput.placeholder = 'e.g. 35 Marylebone Rd, Marylebone, London, NW1 5LS';
      }
    }
  }
}

/**
 * Form Event Handlers & File Drag-and-Drop
 */
function setupFormEventListeners() {
  // Geolocation Button ("Use Current Location")
  const geoBtn = document.getElementById('btn-get-location');
  if (geoBtn) {
    geoBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser.');
        return;
      }
      showToast('Acquiring GPS location...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          pickerMap.setView([lat, lng], 16);
          setMarkerLocation(lat, lng, true);
          showToast('GPS coordinates acquired!');
        },
        (err) => {
          showToast(`Geolocation error: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // Address Search Bar on Map
  const searchAddressBtn = document.getElementById('btn-search-address');
  const addressQuery = document.getElementById('input-search-address');
  if (searchAddressBtn && addressQuery) {
    const runSearch = async () => {
      const q = addressQuery.value.trim();
      if (!q) return;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          pickerMap.setView([lat, lng], 16);
          setMarkerLocation(lat, lng, false);
          document.getElementById('input-address').value = data[0].display_name;
        } else {
          showToast('Location not found. Try clicking the map directly.');
        }
      } catch (err) {
        showToast('Address lookup failed.');
      }
    };
    searchAddressBtn.addEventListener('click', runSearch);
    addressQuery.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch();
      }
    });
  }

  // Dynamic Questions Builder
  const addQBtn = document.getElementById('btn-add-question');
  const qList = document.getElementById('questions-container');
  if (addQBtn && qList) {
    addQBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'question-row';
      row.innerHTML = `
        <input type="text" class="form-input question-input" placeholder="e.g. Who has access to the data?" style="flex: 1;" required>
        <button type="button" class="remove-q-btn" onclick="this.closest('.question-row').remove()" title="Remove question">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      `;
      qList.appendChild(row);
    });
  }

  // File Upload (Drag and Drop + Image Compression)
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const previewBox = document.getElementById('preview-box');
  const previewImg = document.getElementById('preview-img');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processUploadedImage(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        processUploadedImage(fileInput.files[0]);
      }
    });
  }

  function processUploadedImage(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }
    uploadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Client-side canvas resize (max 1600px width/height)
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        uploadedPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        if (previewImg && previewBox) {
          previewImg.src = uploadedPhotoDataUrl;
          previewBox.style.display = 'block';
          dropZone.style.display = 'none';
        }
        showToast('Photo uploaded and optimized successfully!');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Remove uploaded image
  const removePhotoBtn = document.getElementById('btn-remove-photo');
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      uploadedPhotoDataUrl = null;
      uploadedFileName = '';
      if (fileInput) fileInput.value = '';
      if (previewBox) previewBox.style.display = 'none';
      if (dropZone) dropZone.style.display = 'block';
    });
  }

  // Cloudflare Worker Intake Endpoint
  // Paste your deployed Cloudflare Worker URL here once deployed:
  // e.g. "https://casa0014-sensor-intake.d-j-wilson.workers.dev"
  const WORKER_ENDPOINT = "https://casa0014-sensor-intake.d-j-wilson.workers.dev/";

  // Form Submission
  const submitForm = document.getElementById('sensor-submission-form');
  if (submitForm) {
    submitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmission(WORKER_ENDPOINT);
    });
  }

  // Setup Success Modal "Submit Another" button
  const submitAnotherBtn = document.getElementById('btn-submit-another');
  if (submitAnotherBtn) {
    submitAnotherBtn.addEventListener('click', () => {
      const modal = document.getElementById('success-modal');
      if (modal) modal.classList.remove('active');
      submitForm.reset();
      uploadedPhotoDataUrl = null;
      uploadedFileName = '';
      if (previewBox) previewBox.style.display = 'none';
      if (dropZone) dropZone.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Export JSON Button
  const exportBtn = document.getElementById('btn-export-json');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const payload = collectFormData();
      if (!payload) return;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${payload.id || 'sensor-observation'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('JSON observation exported!');
    });
  }
}

/**
 * Collect and validate form values into standardized JSON object
 */
function collectFormData() {
  const title = document.getElementById('input-title')?.value.trim();
  const category = document.getElementById('input-category')?.value;
  const description = document.getElementById('input-description')?.value.trim();
  const lat = parseFloat(document.getElementById('input-lat')?.value);
  const lng = parseFloat(document.getElementById('input-lng')?.value);
  const address = document.getElementById('input-address')?.value.trim();
  const gmapsUrl = document.getElementById('input-gmaps')?.value.trim();
  const w3w = document.getElementById('input-w3w')?.value.trim();
  const authorName = document.getElementById('input-author')?.value.trim();
  const cohort = document.getElementById('input-cohort')?.value.trim();

  if (!title || !description || isNaN(lat) || isNaN(lng)) {
    showToast('Please fill in Title, Description, and select a Location on the map.');
    return null;
  }

  // Collect Questions
  const questions = [];
  document.querySelectorAll('.question-input').forEach(input => {
    const val = input.value.trim();
    if (val) questions.push(val);
  });

  // Slug ID
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || `sensor-${Date.now()}`;

  const categoryMap = {
    'air-quality': 'Air Quality',
    'nature': 'Nature',
    'mobility': 'Mobility & People',
    'energy': 'Energy & Utilities',
    'weather': 'Weather & Climate',
    'infrastructure': 'Infrastructure & Living Lab'
  };

  return {
    id: slug,
    title,
    category: categoryMap[category] || 'Urban Sensor',
    categorySlug: category,
    description,
    parameters: document.getElementById('input-params')?.value.split(',').map(s => s.trim()).filter(Boolean) || [],
    questions,
    location: {
      address,
      lat,
      lng,
      googleMapsUrl: gmapsUrl,
      what3words: w3w,
      area: address ? address.split(',')[0].trim() : 'London'
    },
    contributor: {
      name: authorName || 'CASA Student',
      affiliation: 'UCL CASA Connected Environments',
      date: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      cohort: cohort || '2024/25'
    }
  };
}

/**
 * Main Submission Handler
 * If WORKER_ENDPOINT is set, submits directly via Cloudflare Worker.
 * Otherwise, falls back to generating a GitHub Issue.
 */
async function handleFormSubmission(workerEndpoint) {
  const payload = collectFormData();
  if (!payload) return;

  // Fallback to GitHub Issue if Worker URL is not configured yet
  if (!workerEndpoint || workerEndpoint.trim() === "") {
    handleOptionAGitHubFallback(payload);
    return;
  }

  const submitBtn = document.getElementById('btn-submit-observation');
  const submitText = document.getElementById('btn-submit-text');
  const submitIcon = document.getElementById('btn-submit-icon');

  // Set Loading State
  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = 'Publishing observation...';
  if (submitIcon) {
    submitIcon.outerHTML = `
      <svg id="btn-submit-icon" class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
    `;
  }

  try {
    const response = await fetch(workerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        imageData: uploadedPhotoDataUrl || null,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Server returned ${response.status}`);
    }

    // Success: Show Modal
    const modal = document.getElementById('success-modal');
    const viewLiveBtn = document.getElementById('btn-view-live');
    const modalDesc = document.getElementById('success-modal-desc');

    if (modalDesc) {
      modalDesc.innerHTML = `Your observation of <strong>${escapeHtml(payload.title)}</strong> has been saved and published to the live observatory!`;
    }

    if (viewLiveBtn) {
      const destinationUrl = result.url || `sensor.html?id=${result.id || payload.id}`;
      viewLiveBtn.href = destinationUrl;
    }

    if (modal) {
      modal.classList.add('active');
    } else {
      showToast('Observation successfully published!');
      window.location.href = `sensor.html?id=${result.id || payload.id}`;
    }

  } catch (err) {
    console.error('Submission error:', err);
    showToast(`Submission error: ${err.message}`);
    alert(`We encountered an issue submitting your observation:\n\n${err.message}\n\nPlease try again or export JSON.`);
  } finally {
    // Reset Loading State
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = 'Publish Observation';
    const currentIcon = document.getElementById('btn-submit-icon');
    if (currentIcon) {
      currentIcon.outerHTML = `
        <svg id="btn-submit-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      `;
    }
  }
}

/**
 * Option A Fallback: Generates formatted GitHub Issue URL
 */
function handleOptionAGitHubFallback(payload) {
  showToast('Worker endpoint not set. Opening GitHub Issue...');

  const issueTitle = `[Sensor Submission] ${payload.title}`;
  const issueBody = `### Sensor Name / Title
${payload.title}

### Category
${payload.category} (${payload.categorySlug})

### What is Being Sensed / Description
${payload.description}

### Parameters Measured
${payload.parameters.join(', ')}

### Questions Raised When Visiting Site
${payload.questions.map(q => `- ${q}`).join('\n')}

### Location Information
- **Latitude, Longitude**: \`${payload.location.lat}, ${payload.location.lng}\`
- **Address**: ${payload.location.address}
- **Google Maps Link**: ${payload.location.googleMapsUrl}
- **what3words**: ${payload.location.what3words || 'N/A'}

### Contributor
- **Name**: ${payload.contributor.name}
- **Cohort**: ${payload.contributor.cohort}
- **Date**: ${payload.contributor.date}

---
<!-- SENSOR_DATA_START
${JSON.stringify({
    id: payload.id,
    title: payload.title,
    category: payload.category,
    categorySlug: payload.categorySlug,
    description: payload.description,
    parameters: payload.parameters,
    questions: payload.questions,
    location: payload.location,
    contributor: payload.contributor
  }, null, 2)}
SENSOR_DATA_END -->

### Field Photo
*Please drag and drop your photo into this box before clicking 'Submit new issue'!*
`;

  const repoTarget = "ucl-casa-ce/casa0014-urbantech";
  const issueUrl = `https://github.com/${repoTarget}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}&labels=sensor-submission`;

  window.open(issueUrl, '_blank');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

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

