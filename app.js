document.addEventListener("DOMContentLoaded", () => {
  // Config & State
  let map;
  let hikerMarker;
  let trailPathPoints = [];
  let currentLocation = null;
  let totalTrailMiles = 2197.9; // Official trail length in 2026
  let activeTileLayer;
  let sheltersList = [];
  let shelterMarkers = [];
  let sheltersLayer = null;

  // Mileage anchors mapping simplified GPX cumulative miles to official AT miles
  const mileageAnchors = [
    { gpx: 0.0, official: 0.0 },
    { gpx: 181.28, official: 199.70 },
    { gpx: 414.94, official: 469.00 },
    { gpx: 916.39, official: 1023.70 },
    { gpx: 1172.19, official: 1295.50 },
    { gpx: 1678.15, official: 1852.80 },
    { gpx: 1968.56, official: 2197.90 }
  ];

  // Convert simplified GPX miles to official AT miles using piecewise linear interpolation
  function gpxToOfficialMile(gpxMile) {
    if (gpxMile <= mileageAnchors[0].gpx) return mileageAnchors[0].official;
    if (gpxMile >= mileageAnchors[mileageAnchors.length - 1].gpx) return mileageAnchors[mileageAnchors.length - 1].official;
    
    for (let i = 0; i < mileageAnchors.length - 1; i++) {
      const a = mileageAnchors[i];
      const b = mileageAnchors[i+1];
      if (gpxMile >= a.gpx && gpxMile <= b.gpx) {
        const ratio = (gpxMile - a.gpx) / (b.gpx - a.gpx);
        return a.official + ratio * (b.official - a.official);
      }
    }
    return gpxMile;
  }
  
  // Elements
  const hikerTitle = document.getElementById("hiker-title");
  const milesDoneEl = document.getElementById("miles-done");
  const milesLeftEl = document.getElementById("miles-left");
  const progressPercentEl = document.getElementById("progress-percent");
  const progressFillEl = document.getElementById("progress-fill");
  const progressRatioEl = document.getElementById("progress-ratio");
  const latLongEl = document.getElementById("lat-long");
  const coordBox = document.getElementById("coord-box");
  const gpsTimestampEl = document.getElementById("gps-timestamp");
  const googleMapsBtn = document.getElementById("google-maps-btn");
  const recenterBtn = document.getElementById("recenter-btn");
  const milestonesTimeline = document.getElementById("milestones-timeline");
  
  // Mobile drawer controls
  const mobileToggle = document.getElementById("mobile-toggle");
  const sidebar = document.getElementById("sidebar");

  mobileToggle.addEventListener("click", () => {
    sidebar.classList.toggle("active");
    const icon = mobileToggle.querySelector("i");
    if (sidebar.classList.contains("active")) {
      icon.setAttribute("data-lucide", "x");
    } else {
      icon.setAttribute("data-lucide", "menu");
    }
    lucide.createIcons();
  });

  // Milestones Data (Coordinates represented as official miles from GA terminus)
  const milestones = [
    { name: "Springer Mountain, GA", mile: 0.0, desc: "Southern Terminus of the AT" },
    { name: "Great Smoky Mountains", mile: 199.7, desc: "Clingmans Dome ridge line" },
    { name: "Damascus, VA", mile: 469.0, desc: "Trail Town USA" },
    { name: "Shenandoah National Park", mile: 905.0, desc: "Skyline Drive crossing" },
    { name: "Harpers Ferry, WV", mile: 1023.7, desc: "Psychological Halfway Point" },
    { name: "Delaware Water Gap, PA", mile: 1295.5, desc: "NJ / PA border crossing" },
    { name: "Mount Washington, NH", mile: 1852.8, desc: "Highest peak in the Northeast" },
    { name: "Mount Katahdin, ME", mile: 2197.9, desc: "Northern Terminus of the AT" }
  ];

  // Helper: Haversine distance
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Base map layers definition
  const tileLayers = {
    voyager: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
      maxZoom: 17
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the Giz User Community',
      maxZoom: 19
    })
  };

  // Initializing Leaflet Map
  function initMap(centerLat, centerLon) {
    map = L.map('map', {
      zoomControl: false // disabled default to position top-right in CSS
    }).setView([centerLat, centerLon], 8);

    // Add default layer
    activeTileLayer = tileLayers.voyager;
    activeTileLayer.addTo(map);

    // Zoom controls at top-right
    L.control.zoom({
      position: 'topright'
    }).addTo(map);
  }

  // Switch base map style
  function switchMapStyle(styleKey) {
    if (!map || !tileLayers[styleKey]) return;
    if (activeTileLayer === tileLayers[styleKey]) return;
    
    map.removeLayer(activeTileLayer);
    activeTileLayer = tileLayers[styleKey];
    activeTileLayer.addTo(map);
    
    // Update active button state
    document.querySelectorAll('.style-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`style-${styleKey}`).classList.add('active');
  }

  // Load configuration & data
  async function loadData() {
    try {
      // 1. Fetch current hiker location with a cache buster
      const locResponse = await fetch(`current_location.json?t=${Date.now()}`);
      if (!locResponse.ok) throw new Error("Could not load current_location.json");
      currentLocation = await locResponse.json();

      // 2. Fetch simplified trail track
      const trailResponse = await fetch('public/at_trail.json');
      if (!trailResponse.ok) throw new Error("Could not load public/at_trail.json");
      trailPathPoints = await trailResponse.json();
      
      // 3. Fetch shelters data
      try {
        const sheltersResponse = await fetch('public/shelters.json');
        if (sheltersResponse.ok) {
          sheltersList = await sheltersResponse.json();
        }
      } catch (err) {
        console.warn("Failed to load shelters.json:", err);
      }

      // Initialize page
      initTracker();
    } catch (error) {
      console.error("Error loading tracker data:", error);
      document.body.innerHTML += `<div style="position:absolute;z-index:9999;top:20px;left:20px;right:20px;background:#ef4444;color:white;padding:16px;border-radius:8px;font-family:sans-serif;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,0.5)">Failed to load tracking data. Please make sure both 'current_location.json' and 'public/at_trail.json' exist. Details: ${error.message}</div>`;
    }
  }

  // Main process initialization
  function initTracker() {
    const lat = parseFloat(currentLocation.latitude);
    const lon = parseFloat(currentLocation.longitude);
    const direction = (currentLocation.direction || "NOBO").toUpperCase();
    const isSobo = direction === "SOBO";
    
    // Set up Leaflet Map
    initMap(lat, lon);

    // Find the closest point on the trail to current location
    let minDistance = Infinity;
    let closestIndex = 0;
    
    for (let i = 0; i < trailPathPoints.length; i++) {
      const [tLat, tLon, tMiles] = trailPathPoints[i];
      const dist = haversineDistance(lat, lon, tLat, tLon);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    const gpxMilesFromSpringer = trailPathPoints[closestIndex][2];
    const officialMilesFromSpringer = gpxToOfficialMile(gpxMilesFromSpringer);
    
    // Calculate progress depending on hike direction, with support for manual currentMileage override
    let completedMiles, remainingMiles;
    const manualMileage = parseFloat(currentLocation.currentMileage);
    
    if (currentLocation.currentMileage !== undefined && currentLocation.currentMileage !== null && !isNaN(manualMileage)) {
      if (isSobo) {
        // Hiker is Southbound, but manual mileage is provided as Northbound (from Springer)
        completedMiles = Math.max(0, totalTrailMiles - manualMileage);
        remainingMiles = manualMileage;
      } else {
        // Hiker is Northbound
        completedMiles = manualMileage;
        remainingMiles = Math.max(0, totalTrailMiles - completedMiles);
      }
    } else {
      // Fallback: calculate mileage by projecting coordinates onto the GPX path and applying piecewise linear interpolation
      if (isSobo) {
        completedMiles = totalTrailMiles - officialMilesFromSpringer;
        remainingMiles = officialMilesFromSpringer;
      } else {
        completedMiles = officialMilesFromSpringer;
        remainingMiles = Math.max(0, totalTrailMiles - completedMiles);
      }
    }
    const progressPercent = (completedMiles / totalTrailMiles) * 100;

    // Update Text & Label Elements
    const name = currentLocation.hikerName || "Audrey";
    hikerTitle.innerHTML = `<span class="highlight">${name}</span> on the AT`;
    document.title = `${name} on the AT - Hiker Tracker`;
    
    milesDoneEl.textContent = completedMiles.toFixed(1);
    milesLeftEl.textContent = remainingMiles.toFixed(1);
    progressPercentEl.textContent = `${progressPercent.toFixed(1)}%`;
    progressRatioEl.textContent = `${completedMiles.toFixed(1)} / ${totalTrailMiles.toFixed(1)} mi`;
    
    // Update sublabels dynamically based on hike direction
    const statDoneSub = document.getElementById("stat-done-sub");
    const statLeftSub = document.getElementById("stat-left-sub");
    const progressStartLabel = document.getElementById("progress-start-label");
    const progressEndLabel = document.getElementById("progress-end-label");
    
    if (isSobo) {
      statDoneSub.textContent = "from Katahdin";
      statLeftSub.textContent = "to Springer Mt.";
      progressStartLabel.textContent = "ME";
      progressEndLabel.textContent = "GA";
    } else {
      statDoneSub.textContent = "from Springer Mt.";
      statLeftSub.textContent = "to Katahdin";
      progressStartLabel.textContent = "GA";
      progressEndLabel.textContent = "ME";
    }

    // Animate Progress Bar
    setTimeout(() => {
      progressFillEl.style.width = `${progressPercent}%`;
    }, 100);

    // Coordinates Display & Copy function
    const coordString = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    latLongEl.textContent = coordString;
    
    coordBox.addEventListener("click", () => {
      navigator.clipboard.writeText(coordString).then(() => {
        // Simple visual feedback
        const copyIcon = coordBox.querySelector(".copy-icon");
        coordBox.style.borderColor = "var(--accent)";
        copyIcon.setAttribute("data-lucide", "check");
        lucide.createIcons();
        
        setTimeout(() => {
          coordBox.style.borderColor = "var(--border-color)";
          copyIcon.setAttribute("data-lucide", "copy");
          lucide.createIcons();
        }, 1500);
      });
    });

    // Formatting date
    const dateParsed = new Date(currentLocation.date);
    if (!isNaN(dateParsed.getTime())) {
      const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        timeZoneName: 'short'
      };
      
      // Calculate relative time ago
      const now = new Date();
      const diffMs = now - dateParsed;
      const diffMins = Math.round(diffMs / 60000);
      const diffHours = Math.round(diffMins / 60);
      const diffDays = Math.round(diffHours / 24);
      
      let relativeTime = "";
      if (diffMins < 1) relativeTime = "Just now";
      else if (diffMins < 60) relativeTime = `${diffMins}m ago`;
      else if (diffHours < 24) relativeTime = `${diffHours}h ago`;
      else relativeTime = `${diffDays}d ago`;
      
      gpsTimestampEl.innerHTML = `${dateParsed.toLocaleDateString(undefined, options)} <span style="color: var(--accent-light); font-weight:600; margin-left: 6px;">(${relativeTime})</span>`;
    } else {
      gpsTimestampEl.textContent = currentLocation.date;
    }

    // Google Maps button setup
    googleMapsBtn.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    // Recenter map listener
    recenterBtn.addEventListener("click", () => {
      map.setView([lat, lon], 10, { animate: true, duration: 1.5 });
      // Close mobile drawer on recenter
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active");
        mobileToggle.querySelector("i").setAttribute("data-lucide", "menu");
        lucide.createIcons();
      }
    });

    // Render Trail Polylines based on direction
    let completedCoords, remainingCoords;
    if (isSobo) {
      // Completed trail is from Mount Katahdin (end of array) down to closestIndex
      completedCoords = trailPathPoints.slice(closestIndex).map(pt => [pt[0], pt[1]]);
      // Remaining trail is from closestIndex down to Springer Mt (beginning of array)
      remainingCoords = trailPathPoints.slice(0, closestIndex + 1).map(pt => [pt[0], pt[1]]);
    } else {
      // Completed trail is from Springer Mt (beginning) up to closestIndex
      completedCoords = trailPathPoints.slice(0, closestIndex + 1).map(pt => [pt[0], pt[1]]);
      // Remaining trail is from closestIndex to Mount Katahdin (end)
      remainingCoords = trailPathPoints.slice(closestIndex).map(pt => [pt[0], pt[1]]);
    }
    
    // If hiker is slightly off-trail, connect their actual current position to the completed line for accuracy
    if (minDistance > 0.05) {
      if (isSobo) {
        completedCoords.unshift([lat, lon]); // Prepend current position for SOBO
      } else {
        completedCoords.push([lat, lon]); // Append current position for NOBO
      }
    }
    
    const completedLine = L.polyline(completedCoords, {
      color: '#10b981',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      shadowColor: 'rgba(16, 185, 129, 0.4)',
      shadowBlur: 10
    }).addTo(map);

    const remainingLine = L.polyline(remainingCoords, {
      color: '#475569',
      weight: 3.5,
      opacity: 0.6,
      dashArray: '5, 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    // Draw Endpoints
    // Springer Mt (GA)
    const startPoint = trailPathPoints[0];
    const startIcon = L.divIcon({
      className: 'start-marker-icon',
      html: `<div style="background:#374151; width:12px; height:12px; border:2px solid #fff; border-radius:50%"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker([startPoint[0], startPoint[1]], { icon: startIcon })
      .addTo(map)
      .bindPopup("<b>Springer Mountain, GA</b><br>" + (isSobo ? "Southern Terminus (SOBO Finish)" : "Southern Terminus (NOBO Start)"));

    // Mount Katahdin (ME)
    const endPoint = trailPathPoints[trailPathPoints.length - 1];
    const endIcon = L.divIcon({
      className: 'end-marker-icon',
      html: `<div style="background:#b91c1c; width:12px; height:12px; border:2px solid #fff; border-radius:50%"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker([endPoint[0], endPoint[1]], { icon: endIcon })
      .addTo(map)
      .bindPopup("<b>Mount Katahdin, ME</b><br>" + (isSobo ? "Northern Terminus (SOBO Start)" : "Northern Terminus (NOBO Finish)"));

    // Hiker Pulse Icon
    const pulseIcon = L.divIcon({
      className: 'leaflet-pulse-icon',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    hikerMarker = L.marker([lat, lon], { icon: pulseIcon }).addTo(map);
    hikerMarker.bindPopup(`<b>${name} is here!</b><br>Mile ${completedMiles.toFixed(1)} (${direction})<br>${coordString}`).openPopup();

    // Render Milestone list in timeline
    renderMilestones(completedMiles, isSobo);

    // Initialize and display shelters
    initShelters();

    // Setup map style switch listeners
    document.getElementById('style-voyager').addEventListener('click', () => switchMapStyle('voyager'));
    document.getElementById('style-topo').addEventListener('click', () => switchMapStyle('topo'));
    document.getElementById('style-satellite').addEventListener('click', () => switchMapStyle('satellite'));

    // Fit map bounds slightly to include starting view, with focus on the current marker
    map.setView([lat, lon], 9);

    // Setup Lucide icons
    lucide.createIcons();
  }

  // Initialize and render shelters
  function initShelters() {
    if (!sheltersList || sheltersList.length === 0) return;
    
    shelterMarkers = sheltersList.map(s => {
      const marker = L.circleMarker([s.lat, s.lon], {
        radius: 4,
        fillColor: '#10b981', // emerald
        color: '#ffffff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.85
      });
      
      const popupContent = `
        <div class="shelter-popup">
          <h4>${s.name}</h4>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <span class="shelter-badge ${s.type.toLowerCase()}">${s.type}</span>
            ${s.capacity && s.capacity !== '0' && s.capacity !== 'Unknown' ? `<span class="shelter-badge" style="background: rgba(255,255,255,0.05); color: var(--text-main);">Sleeps ${s.capacity}</span>` : ''}
          </div>
          ${s.ele ? `<div class="shelter-ele">Elevation: ${(s.ele * 3.28084).toFixed(0)} ft (${s.ele.toFixed(0)} m)</div>` : ''}
          ${s.state ? `<div class="shelter-state">State: ${s.state}</div>` : ''}
          ${s.notes ? `<p class="shelter-notes">${s.notes}</p>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent, {
        className: 'custom-leaflet-popup'
      });
      
      marker.bindTooltip(s.name, {
        direction: 'top',
        className: 'custom-leaflet-tooltip'
      });
      
      return marker;
    });
    
    sheltersLayer = L.layerGroup(shelterMarkers);
    
    // Add event listeners
    map.on('zoomend', updateSheltersVisibility);
    document.getElementById("toggle-shelters").addEventListener("change", updateSheltersVisibility);
    
    // Initial draw
    updateSheltersVisibility();
  }
  
  function updateSheltersVisibility() {
    if (!map || !sheltersLayer) return;
    
    const zoom = map.getZoom();
    const showSheltersChecked = document.getElementById("toggle-shelters").checked;
    
    if (!showSheltersChecked) {
      if (map.hasLayer(sheltersLayer)) {
        map.removeLayer(sheltersLayer);
      }
      return;
    }
    
    // Show shelters if zoom is >= 7
    if (zoom >= 7) {
      if (!map.hasLayer(sheltersLayer)) {
        map.addLayer(sheltersLayer);
      }
      
      // Scale radius based on zoom level
      const radius = zoom >= 12 ? 6.5 : (zoom >= 10 ? 5 : (zoom >= 8 ? 4 : 3));
      shelterMarkers.forEach(marker => {
        marker.setRadius(radius);
      });
    } else {
      if (map.hasLayer(sheltersLayer)) {
        map.removeLayer(sheltersLayer);
      }
    }
  }

  // Render Milestones in Timeline
  function renderMilestones(completedMiles, isSobo) {
    milestonesTimeline.innerHTML = "";
    
    // Order milestones from Start to End based on direction
    let orderedMilestones = [...milestones];
    if (isSobo) {
      orderedMilestones.reverse();
    }
    
    // Find the next upcoming milestone index
    let nextMilestoneIdx = -1;
    for (let i = 0; i < orderedMilestones.length; i++) {
      const m = orderedMilestones[i];
      const mCompletedMiles = isSobo ? (totalTrailMiles - m.mile) : m.mile;
      if (completedMiles < mCompletedMiles) {
        nextMilestoneIdx = i;
        break;
      }
    }
    if (nextMilestoneIdx === -1) nextMilestoneIdx = orderedMilestones.length; // all completed
    
    orderedMilestones.forEach((m, idx) => {
      const mCompletedMiles = isSobo ? (totalTrailMiles - m.mile) : m.mile;
      const isCompleted = completedMiles >= mCompletedMiles;
      const isCurrent = idx === nextMilestoneIdx;
      
      let statusClass = "";
      if (isCompleted) statusClass = "completed";
      else if (isCurrent) statusClass = "current";
      
      // Calculate status badge HTML
      let badgeHtml = "";
      if (isCurrent) {
        badgeHtml = `<span class="milestone-badge current-badge">Next Target</span>`;
      } else if (isCompleted) {
        badgeHtml = `<span class="milestone-badge completed-badge">Passed</span>`;
      }
      
      // Calculate mileage distance from hiker's starting terminus
      let displayMile = isSobo ? (totalTrailMiles - m.mile) : m.mile;
      if (Math.abs(displayMile) < 0.1) displayMile = 0.0;
      
      const item = document.createElement("div");
      item.className = `timeline-item ${statusClass}`;
      item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-title">${m.name}${badgeHtml ? ' ' + badgeHtml : ''}</span>
            <span class="timeline-mile">${displayMile.toFixed(0)} mi</span>
          </div>
          <p class="timeline-desc">${m.desc}</p>
        </div>
      `;
      milestonesTimeline.appendChild(item);
    });
  }

  // Run data fetch
  loadData();
});
