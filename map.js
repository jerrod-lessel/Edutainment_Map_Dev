// ===============================
// Initialize the map
// ===============================
const map = L.map('map', {
  zoomControl: true,
  attributionControl: false
});

// Guadalupe-focused view
map.setView([34.9715, -120.5713], 13);

// Basemap
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  { maxZoom: 18 }
).addTo(map);

// ===============================
// Layer Groups (SimCity toggles)
// ===============================
const learningLayer = L.layerGroup().addTo(map);
const newsLayer = L.layerGroup().addTo(map);

// ===============================
// Guadalupe bounds
// ===============================
const guadalupeBounds = L.latLngBounds(
  [34.920, -120.640], // SW
  [35.010, -120.500]  // NE
);

map.setMaxBounds(guadalupeBounds);
map.on('drag', () => {
  map.panInsideBounds(guadalupeBounds, { animate: false });
});

L.rectangle(guadalupeBounds, {
  color: '#666',
  weight: 1,
  dashArray: '4,4',
  fillOpacity: 0
}).addTo(map);

// ===============================
// Utilities
// ===============================
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function progressKey(nodeId) {
  return `pc_progress_${nodeId}`;
}

function answeredKey(nodeId, idx) {
  return `pc_answered_${nodeId}_${idx}`;
}

function getProgress(nodeId) {
  const raw = localStorage.getItem(progressKey(nodeId));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setProgress(nodeId, idx) {
  localStorage.setItem(progressKey(nodeId), String(idx));
}

// ===============================
// STATUS HUD (Curiosity Level)
// ===============================
// Stores total questions once knowledge_nodes.geojson is loaded
window._pcTotals = { totalQuestions: 0 };

function computeOverallProgress() {
  // Count answered questions by scanning localStorage keys
  let answered = 0;

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("pc_answered_") && localStorage.getItem(key) === "1") {
      answered++;
    }
  }

  return { answered, total: window._pcTotals.totalQuestions || 0 };
}

function getCurrentLevel() {
  const { answered } = computeOverallProgress();
  return 1 + Math.floor(answered / 3);
}

function updateStatusHud() {
  const levelEl = document.getElementById("cur-level");
  const scoreEl = document.getElementById("cur-score");
  if (!levelEl || !scoreEl) return;

  const { answered, total } = computeOverallProgress();

  // Simple leveling: every 3 correct answers = +1 level
  const level = 1 + Math.floor(answered / 3);

  levelEl.textContent = String(level);
  scoreEl.textContent = `${answered} / ${total}`;
  // If a popup is open, refresh it so locked nodes can unlock live
  if (map && map._popup && map._popup._pcFeature) {
    const f = map._popup._pcFeature;
    const need = f?.properties?.minLevel || 1;
    const level = getCurrentLevel();
    map._popup.setContent(level >= need ? renderNodeCard(f) : renderLockedCard(f));
    setTimeout(() => wirePopupBehavior(map._popup), 0);
  }
}

// Add the Status HUD panel (top-right)
const statusHud = L.control({ position: "topright" });

statusHud.onAdd = function () {
  const div = L.DomUtil.create("div", "sim-status");
  div.innerHTML = `
    <div class="sim-status-title">STATUS</div>
    <div class="sim-status-line"><span>Curiosity Level</span><b id="cur-level">1</b></div>
    <div class="sim-status-line"><span>Knowledge</span><b id="cur-score">0 / 0</b></div>
  `;

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
};

statusHud.addTo(map);

// ===============================
// Render knowledge node panel
// ===============================
function renderNodeCard(feature) {
  const p = feature.properties;
  const nodeId = p.id;
  const questions = p.questions || [];
  const idx = Math.min(getProgress(nodeId), questions.length - 1);
  const q = questions[idx] || {};

  const answered = localStorage.getItem(answeredKey(nodeId, idx)) === "1";
  const message = feature._pcMessage || "";

  const choices = Array.isArray(q.choices) ? q.choices : [];
  const choicesHtml = choices.length
    ? `<div class="pc-choices">
        ${choices.map((c, i) => `
          <button
            class="pc-choice"
            data-action="choose"
            data-choice="${i}"
            ${answered ? "disabled" : ""}
          >
            ${escapeHtml(c)}
          </button>
        `).join("")}
      </div>`
    : "";

  const explainHtml = answered && q.explain
    ? `<div class="pc-explain"><b>Explanation:</b> ${escapeHtml(q.explain)}</div>`
    : "";

  const msgHtml = message
    ? `<div class="pc-msg">${escapeHtml(message)}</div>`
    : "";

  const done = idx >= questions.length - 1;
  const canNext = answered && !done;

  return `
    <div class="pc-card" data-node="${escapeHtml(nodeId)}" data-idx="${idx}">
      <div class="pc-title">${escapeHtml(p.title || "Knowledge Node")}</div>
      ${p.subtitle ? `<div class="pc-subtitle">${escapeHtml(p.subtitle)}</div>` : ""}

      <div class="pc-qmeta">Question ${idx + 1} of ${questions.length}</div>
      <div class="pc-question">${escapeHtml(q.question || "")}</div>

      ${msgHtml}
      ${choicesHtml}
      ${explainHtml}

      <div class="pc-actions">
        <button class="pc-btn" data-action="reset">Reset</button>
        <button class="pc-btn pc-primary" data-action="next" ${canNext ? "" : "disabled"}>
          ${done ? "Completed" : "Next"}
        </button>
      </div>
    </div>
  `;
}

function renderLockedCard(feature) {
  const p = feature.properties || {};
  const need = p.minLevel || 1;

  return `
    <div class="pc-card">
      <div class="pc-title">🔒 LOCKED</div>
      <div class="pc-subtitle">${escapeHtml(p.title || "Knowledge Node")}</div>
      <div class="pc-question">
        Reach <b>Curiosity Level ${need}</b> to unlock this node.
      </div>
      <div class="pc-qmeta">Tip: answer more questions to level up.</div>
    </div>
  `;
}


// ===============================
// Popup interaction logic
// ===============================
function wirePopupBehavior(popup) {
  const el = popup.getElement();
  if (!el) return;

  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const card = e.target.closest(".pc-card");
    if (!card) return;

    const nodeId = card.getAttribute("data-node");
    const idx = parseInt(card.getAttribute("data-idx"), 10);
    const action = btn.getAttribute("data-action");

    const feature = popup._pcFeature;
    const questions = feature.properties.questions || [];
    const q = questions[idx];

    if (action === "reset") {
      setProgress(nodeId, 0);
      for (let i = 0; i < questions.length; i++) {
        localStorage.removeItem(answeredKey(nodeId, i));
      }
      feature._pcMessage = "";
    }

    if (action === "choose") {
      const choice = parseInt(btn.getAttribute("data-choice"), 10);
      if (q && Number.isInteger(q.correct)) {
        if (choice === q.correct) {
          localStorage.setItem(answeredKey(nodeId, idx), "1");
          feature._pcMessage = "";
        } else {
          feature._pcMessage = "Not quite — try again 🙂";
        }
      }
    }

    if (action === "next") {
      if (localStorage.getItem(answeredKey(nodeId, idx)) === "1") {
        setProgress(nodeId, idx + 1);
      }
    }

    const need = feature?.properties?.minLevel || 1;
    const level = getCurrentLevel();
    if (level < need) {
      // Locked: ignore button clicks and just keep the locked view
      popup.setContent(renderLockedCard(feature));
      return;
    }
    popup.setContent(level >= need ? renderNodeCard(feature) : renderLockedCard(feature));
    setTimeout(() => wirePopupBehavior(popup), 0);

    // Update the status HUD whenever something changes
    updateStatusHud();
  }, { passive: false });
}

// ===============================
// Load knowledge nodes
// ===============================
fetch(`data/knowledge_nodes.geojson?v=${Date.now()}`)
  .then(r => r.json())
  .then(geojson => {
    // Register total question count for status HUD
    const totalQuestions = (geojson.features || []).reduce((sum, f) => {
      const qs = f?.properties?.questions || [];
      return sum + qs.length;
    }, 0);
    window._pcTotals = { totalQuestions };

    L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        const kind = feature?.properties?.kind || "default";

        // Base style for all knowledge nodes
        const base = {
          radius: 8,
          weight: 2,
          fillOpacity: 0.95
        };

        // Per-kind styling (easy to tweak later)
        const stylesByKind = {
          hydrology:      { color: "#2c7be5", fillColor: "#2c7be5" }, // blue
          geomorphology:  { color: "#b7791f", fillColor: "#b7791f" }, // dune-ish brown
          infrastructure: { color: "#6b7280", fillColor: "#6b7280" }, // steel gray
          ecology:        { color: "#2f855a", fillColor: "#2f855a" }, // green
          urban:          { color: "#7c3aed", fillColor: "#7c3aed" }, // purple
          default:        { color: "#2c7be5", fillColor: "#2c7be5" }
        };

        const style = stylesByKind[kind] || stylesByKind.default;

        return L.circleMarker(latlng, { ...base, ...style });
      },

      onEachFeature: (feature, layer) => {
        layer.bindPopup(() => {
          const need = feature?.properties?.minLevel || 1;
          const level = getCurrentLevel();
          return (level >= need) ? renderNodeCard(feature) : renderLockedCard(feature);
        }, {
          maxWidth: 340,
          autoPan: true,
          keepInView: true,
          autoPanPaddingTopLeft: [20, 80],
          autoPanPaddingBottomRight: [20, 20],
          offset: L.point(0, 12)
        });

        layer.on("popupopen", (e) => {
          const popup = e.popup;
          popup._pcFeature = feature;

          map.panInside(e.popup.getLatLng(), { padding: [20, 20] });

          setTimeout(() => wirePopupBehavior(popup), 0);
        });
      }
    }).addTo(learningLayer);

    // Update HUD once nodes are loaded
    updateStatusHud();
  })
  .catch(err => {
    console.error(err);
    alert("Failed to load knowledge nodes.");
  });

// ===============================
// Positive News Pins
// ===============================
fetch(`data/positive_news.geojson?v=${Date.now()}`)
  .then(r => r.json())
  .then(geojson => {
    L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 9,
          color: "#f0b429",
          fillColor: "#f0b429",
          weight: 2,
          fillOpacity: 0.95
        });
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;

        const html = `
          <div class="pc-card">
            <div class="pc-title">🟡 ${escapeHtml(p.title || "Positive news")}</div>
            ${p.date ? `<div class="pc-qmeta">${escapeHtml(p.date)}</div>` : ""}
            <div class="pc-question">${escapeHtml(p.summary || "")}</div>
            <div class="pc-actions" style="flex-wrap:wrap;">
              <a class="pc-btn pc-primary" href="${p.article_url}" target="_blank" rel="noopener">Read article</a>
              <a class="pc-btn" href="${p.wiki_url}" target="_blank" rel="noopener">Wikipedia</a>
              <a class="pc-btn" href="${p.charity_url}" target="_blank" rel="noopener">How to help</a>
            </div>
          </div>
        `;

        layer.bindPopup(html, {
          maxWidth: 360,
          autoPan: true,
          keepInView: true,
          autoPanPaddingTopLeft: [20, 80],
          autoPanPaddingBottomRight: [20, 20],
          offset: L.point(0, 12)
        });
      }
    }).addTo(newsLayer);
  })
  .catch(err => {
    console.error(err);
  });

// ===============================
// SimCity-style Legend
// ===============================
const legend = L.control({ position: "bottomleft" });

legend.onAdd = function () {
  const div = L.DomUtil.create("div", "sim-legend");

  div.innerHTML = `
    <div class="sim-legend-title">CITY INFO</div>

    <div class="sim-legend-item">
      <span class="sim-dot hydrology"></span>
      Water Systems
    </div>

    <div class="sim-legend-item">
      <span class="sim-dot geomorphology"></span>
      Landforms
    </div>

    <div class="sim-legend-item">
      <span class="sim-dot infrastructure"></span>
      Development
    </div>

    <div class="sim-legend-item">
      <span class="sim-dot news"></span>
      Positive News
    </div>
  `;

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  return div;
};

legend.addTo(map);

// ===============================
// SimCity-style Layer Toggle Panel
// ===============================
const layersPanel = L.control({ position: "topleft" });

layersPanel.onAdd = function () {
  const div = L.DomUtil.create("div", "sim-layers");

  div.innerHTML = `
    <div class="sim-layers-title">LAYERS</div>

    <label class="sim-layer-item">
      <input type="checkbox" id="toggle-learning" checked />
      <span>Learning Nodes</span>
    </label>

    <label class="sim-layer-item">
      <input type="checkbox" id="toggle-news" checked />
      <span>Positive News</span>
    </label>
  `;

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  setTimeout(() => {
    const learnCb = div.querySelector("#toggle-learning");
    const newsCb = div.querySelector("#toggle-news");

    learnCb.addEventListener("change", () => {
      if (learnCb.checked) map.addLayer(learningLayer);
      else map.removeLayer(learningLayer);
    });

    newsCb.addEventListener("change", () => {
      if (newsCb.checked) map.addLayer(newsLayer);
      else map.removeLayer(newsLayer);
    });
  }, 0);

  return div;
};

layersPanel.addTo(map);
