/* Integrated script.js
   - core weather + AQI + map
   - multilingual toggle (EN/HI)
   - voice search + TTS
   - ML Alert (decision-tree style)
   - Mood Prediction (rule-based scoring)
   - Micro-Climate Prediction (poly regression degree 2 + Chart.js)
   - Disease Risk Scoring
*/

/* ------------------ CONFIG ------------------ */
// Put your OpenWeather API key here:
const API_KEY = "20da423906ccf27bec8c2d81c8f4a2eb";

/* ------------------ DOM ------------------ */
const cityNameEle = document.querySelector("#city-name");
const formEle = document.querySelector("#weather-form");
const imgIcon = document.querySelector(".icon");
const voiceSearchBtn = document.querySelector("#voiceSearch");
const recommendationsEle = document.querySelector("#recommendations");
const appTitleEle = document.querySelector("#app-title");
const submitBtnEle = document.querySelector('#weather-form input[type="submit"]');
const btnLangEn = document.querySelector("#btn-lang-en");
const btnLangHi = document.querySelector("#btn-lang-hi");

const tempEle = document.querySelector(".temp");
const descEle = document.querySelector(".desc");
const detailsEle = document.querySelector(".details");
const mlAlertEle = document.querySelector("#ml-alert");

// mood mini UI
const moodIcon = document.getElementById("moodIcon");
const moodLabel = document.getElementById("moodLabel");
const moodConfidence = document.getElementById("moodConfidence");
const moodSuggestionsMini = document.getElementById("moodSuggestionsMini");

// micro-climate
const microCanvas = document.getElementById("micro-chart");
const microExplain = document.getElementById("micro-explain");


// disease risk
const riskGroup = document.getElementById("risk-group");
const riskLevelEl = document.getElementById("risk-level");
const riskScoreEl = document.getElementById("risk-score");
const riskAdviceEl = document.getElementById("risk-advice");

// ---- Micro-chart canvas element (safe lookup) ----
// Ensure this matches the canvas id in your HTML: <canvas id="micro-chart"></canvas>
const microCanvasEl =
  (typeof document !== "undefined" && (document.getElementById("micro-chart") ||
    document.querySelector("canvas#micro-chart"))) || null;

// chart instance holder
let microChart = window.microChartInstance || null;
window.microChartInstance = microChart; // keep on window for persistence across reloads (optional)


/* ------------------ MAP ------------------ */
let map, marker;
function initMap() {
  if (map) return;
  map = L.map("map").setView([20.5937,78.9629],4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
}

/* ------------------ TRANSLATIONS ------------------ */
let currentLang = "en";
const translations = {
  en: {
    appTitle: "Weather App",
    cityPlaceholder: "Enter your city name",
    getWeatherBtn: "Get weather",
    voiceSearch: "🎤 Voice Search",
    mlAlertTitle: "ML Weather Alert",
    recDefault: "Weather looks normal. Have a great day! 😊"
  },
  hi: {
    appTitle: "मौसम ऐप",
    cityPlaceholder: "अपना शहर का नाम दर्ज करें",
    getWeatherBtn: "मौसम देखें",
    voiceSearch: "🎤 वॉइस सर्च",
    mlAlertTitle: "एमएल मौसम चेतावनी",
    recDefault: "मौसम सामान्य है।"
  }
};
function t(key) { return (translations[currentLang] && translations[currentLang][key]) || translations['en'][key] || key; }
function applyTranslations() {
  appTitleEle.textContent = t("appTitle");
  cityNameEle.placeholder = t("cityPlaceholder");
  submitBtnEle.value = t("getWeatherBtn");
  voiceSearchBtn.textContent = t("voiceSearch");
}

/* lang toggle */
btnLangEn.addEventListener("click", ()=> setLanguage("en"));
btnLangHi.addEventListener("click", ()=> setLanguage("hi"));
function setLanguage(lang){
  currentLang = lang;
  btnLangEn.classList.toggle("active", lang==="en");
  btnLangHi.classList.toggle("active", lang==="hi");
  applyTranslations();
}

/* ------------------ EVENT: FORM ------------------ */
formEle.addEventListener("submit", (e)=>{
  e.preventDefault();
  const city = cityNameEle.value.trim();
  if (!city) return;
  fetchAndRenderAll(city);
});

/* ------------------ VOICE SEARCH ------------------ */
voiceSearchBtn.addEventListener("click", ()=>{
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Voice search not supported");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = currentLang === "hi" ? "hi-IN" : "en-US";
  recognition.start();
  recognition.onresult = (ev) => {
    const city = ev.results[0][0].transcript;
    cityNameEle.value = city;
    fetchAndRenderAll(city);
  };
  recognition.onerror = ()=> alert("Voice recognition error");
});

/* ------------------ MAIN: fetch weather + aqi + run features ------------------ */
async function fetchAndRenderAll(city) {
  try {
    // Basic weather
    const wResp = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`);
    if (!wResp.ok) throw new Error("City not found or API error");
    const w = await wResp.json();

    // Primary data
    const lat = w.coord.lat;
    const lon = w.coord.lon;
    const temperature = Math.round(w.main.temp);
    const feels = Math.round(w.main.feels_like);
    const humidity = w.main.humidity;
    const wind = w.wind.speed;
    const desc = w.weather[0].description;
    const icon = w.weather[0].icon;

    // AQI
    let aqiIndex = null;
    try {
      const aqiResp = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
      if (aqiResp.ok) {
        const aqiData = await aqiResp.json();
        aqiIndex = aqiData.list && aqiData.list[0] && aqiData.list[0].main ? aqiData.list[0].main.aqi : null;
      }
    } catch(e){ aqiIndex = null; }

    // Render weather
    tempEle.textContent = `${temperature}°C`;
    descEle.textContent = desc;
    imgIcon.innerHTML = `<img src="https://openweathermap.org/img/wn/${icon}.png" alt="">`;

    // details
    let detailsHTML = [
      `Feels Like: ${feels}°C`,
      `Humidity: ${humidity}%`,
      `Wind Speed: ${wind} m/s`
    ].map(d => `<div>${d}</div>`).join("");
    if (aqiIndex !== null) {
      // aqiLabel mapping (simple)
      const map = ["Good","Fair","Moderate","Poor","Very Poor"];
      const aqiLabel = map[Math.max(0,Math.min(4,aqiIndex-1))] || "Unknown";
      const aqiClass = aqiIndex <= 1 ? "aqi-good" : aqiIndex===2 ? "aqi-fair" : aqiIndex===3 ? "aqi-moderate" : aqiIndex===4 ? "aqi-poor" : "aqi-very-poor";
      detailsHTML += `<div class="aqi-badge ${aqiClass}">AQI: ${aqiIndex} (${aqiLabel})</div>`;
    } else {
      detailsHTML += `<div class="aqi-badge">AQI: N/A</div>`;
    }
    detailsEle.innerHTML = detailsHTML;

    // recommendations (basic)
    const recs = [];
    if (/rain|drizzle|thunder/i.test(desc)) recs.push("It may rain. Carry an umbrella.");
    if (temperature >= 32) recs.push("Hot today — drink water and avoid peak sun.");
    if (temperature <= 10) recs.push("Cold — wear warm clothes.");
    if (aqiIndex >= 4) recs.push("High pollution — limit outdoor activity.");
    if (recs.length===0) recs.push(t("recDefault"));
    renderRecommendations(recs);

    // Map
    updateMap(lat, lon, `${w.name}, ${w.sys.country}`, temperature, desc);

    // ML Alert (decision-tree style)
    const mlAlert = computeMLAlert(temperature, humidity, aqiIndex, desc);
    renderMLAlert(mlAlert);

    // Mood prediction (full rules)
    const moodPred = computeMood({ temp: temperature, humidity, aqiIndex, desc, hour: new Date().getHours() });
    renderMood(moodPred);

    // Micro-climate predictor: fetch hourly onecall and fit poly
    fetchAndPredictMicro(lat, lon);

    // Disease risk scoring
    computeDiseaseRisk({ temp: temperature, humidity, desc, aqiIndex });

  } catch (err) {
    console.error(err);
    descEle.textContent = "Error: " + err.message;
  }
}

/* ------------------ MAP UPDATE ------------------ */
function updateMap(lat, lon, cityName, temp, desc) {
  initMap();
  const position = [lat, lon];
  map.setView(position, 10);
  const popupText = `<strong>${cityName}</strong><br>${temp}°C, ${desc}`;
  if (marker) {
    marker.setLatLng(position).setPopupContent(popupText);
  } else {
    marker = L.marker(position).addTo(map).bindPopup(popupText);
  }
  marker.openPopup();
}

/* ------------------ RECOMMENDATIONS RENDER ------------------ */
function renderRecommendations(recs) {
  if (!recommendationsEle) return;
  recommendationsEle.innerHTML = `<h2>Recommendations</h2><ul>${recs.map(r=>`<li>${r}</li>`).join("")}</ul>`;
}

/* ------------------ ML ALERT (decision-tree style) ------------------ */
function computeMLAlert(temperature, humidity, aqiIndex, description) {
  const descLower = (description||"").toLowerCase();
  if (aqiIndex !== null && aqiIndex >= 4) return { type:"pollution", severity:"high", icon:"😷" };
  if (temperature >= 35 && humidity >= 40) return { type:"heat", severity:"medium", icon:"🌡️" };
  if (/rain|drizzle|thunder/i.test(descLower)) return { type:"rain", severity:"medium", icon:"🌧️" };
  return { type:"normal", severity:"low", icon:"✅" };
}
function renderMLAlert(alert) {
  if (!mlAlertEle) return;
  let title="", text="", sevClass="";
  switch(alert.type){
    case "heat": title = currentLang==="hi" ? "गर्मी की चेतावनी" : "Heat Alert"; text = currentLang==="hi" ? "उच्च तापमान। बाहर जाने से बचें।" : "High temperature detected. Avoid peak sun."; sevClass="ml-severity-medium"; break;
    case "rain": title = currentLang==="hi" ? "बारिश की चेतावनी" : "Rain Alert"; text = currentLang==="hi" ? "बारिश संभव। छतरी रखें।" : "Rain likely. Carry umbrella."; sevClass="ml-severity-medium"; break;
    case "pollution": title = currentLang==="hi" ? "प्रदूषण चेतावनी" : "Pollution Alert"; text = currentLang==="hi" ? "वायु गुणवत्ता खराब है। बाहर जाने से बचें।" : "Poor air quality. Limit outdoor exposure."; sevClass="ml-severity-high"; break;
    default: title = currentLang==="hi" ? "सामान्य दिन" : "Normal Day"; text = t("recDefault"); sevClass="ml-severity-low"; break;
  }
  mlAlertEle.innerHTML = `
    <div class="ml-alert-header">
      <span class="ml-alert-icon">${alert.icon}</span>
      <div>
        <div class="ml-alert-title">${t("mlAlertTitle")} — ${title}</div>
        <div class="ml-alert-severity ${sevClass}">${alert.severity.toUpperCase()}</div>
      </div>
    </div>
    <div class="ml-alert-text" style="margin-top:6px">${text}</div>
  `;
}

/* ------------------ MOOD PREDICTION ------------------ */
/* computeMood: rule-based scoring (explainable), returns label + score + suggestions */
function computeMood({ temp, humidity, cloud=0, aqiIndex=null, desc="", hour=12 }) {
  let scores = { happy:0, neutral:0, low:0, anxious:0 };
  if (temp>=24 && temp<=30) { scores.happy+=2; scores.neutral+=1; }
  if (temp<12) { scores.low+=2; scores.neutral+=1; }
  if (temp>=31) { scores.anxious+=1; scores.low+=1; }

  if (humidity>=75) { scores.low+=1; scores.anxious+=1; }
  if (humidity<40) { scores.happy+=1; }

  if (/rain|drizzle|thunder/i.test(desc)) { scores.low+=2; scores.anxious+=1; }
  else { if (cloud<=25) scores.happy+=1; if (cloud>70) scores.low+=1; }

  if (aqiIndex !== null) {
    if (aqiIndex>=4) { scores.anxious+=2; scores.low+=1; }
    else if (aqiIndex===3) scores.anxious+=1;
    else scores.happy+=0.5;
  }

  if (hour>=6 && hour<=10) scores.happy+=0.7;
  if (hour>=22 || hour<=4) scores.low+=0.6;

  const total = Object.values(scores).reduce((a,b)=>a+b,0) || 1;
  const normalized = Object.fromEntries(Object.entries(scores).map(([k,v])=>[k, v/total]));
  const sorted = Object.entries(normalized).sort((a,b)=>b[1]-a[1]);
  const [topLabel, topScore] = sorted[0];

  const reasons = [`Temp: ${temp}°C`, `Humidity: ${humidity}%`];
  if (aqiIndex!==null) reasons.push(`AQI: ${aqiIndex}`);
  if (desc) reasons.push(`Cond: ${desc}`);
  reasons.push(`Hour: ${hour}:00`);

  const suggestions = [];
  if (topLabel==="happy") suggestions.push("Good for outdoor activities.");
  if (topLabel==="low") suggestions.push("Consider indoor restful activities.");
  if (topLabel==="anxious") suggestions.push("Avoid heavy outdoor exercise, take short breaks.");
  if (topLabel==="neutral") suggestions.push("Standard care: hydrate and plan as usual.");

  return { label: topLabel, score: Math.round(topScore*100), reasons, suggestions };
}

function renderMood(pred) {
  const iconMap = { happy:"😄", neutral:"😐", low:"😔", anxious:"😟" };
  const labelMap = { happy:"Happy", neutral:"Neutral", low:"Low Energy", anxious:"Anxious" };
  moodIcon.textContent = iconMap[pred.label] || "🙂";
  moodLabel.textContent = labelMap[pred.label] || pred.label;
  moodConfidence.textContent = `Confidence: ${pred.score}%`;
  moodSuggestionsMini.innerHTML = pred.suggestions.map(s => `<div>${s}</div>`).join("");
}

/* ------------------ MICRO-CLIMATE (Regression) ------------------ */
/* fetch hourly from OneCall and fit polynomial degree 2, predict next 6 hours */
// Robust micro-climate fetch & predict (paste into script.js, replace older function)
// Requires globals: API_KEY, microCanvasEl, microExplain, microChart (same names used earlier)

async function fetchAndPredictMicro(lat, lon) {
  try {
    if (!microCanvasEl) {
      console.warn("#micro-chart element not found; skipping micro-climate prediction.");
      if (typeof microExplain !== "undefined" && microExplain) {
        microExplain.textContent = "Micro forecast disabled: missing canvas element (#micro-chart).";
      }
      return;
    }
    // ... rest of the function continues unchanged ...

    // Try OneCall (hourly) first
    let hourly = null;
    try {
      const onecallUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,daily,alerts&appid=${API_KEY}&units=metric`;
      const oneResp = await fetch(onecallUrl);
      if (oneResp.ok) {
        const oneData = await oneResp.json();
        if (Array.isArray(oneData.hourly) && oneData.hourly.length >= 6) {
          hourly = oneData.hourly; // use these hourly points
        } else {
          console.warn("OneCall returned insufficient hourly points, will fallback to /forecast.");
        }
      } else {
        // log the reason; use fallback
        const txt = await oneResp.text().catch(()=>"");
        console.warn("OneCall fetch status:", oneResp.status, oneResp.statusText, txt);
      }
    } catch (err) {
      console.warn("OneCall fetch error:", err);
    }

    // If OneCall failed, fallback to 3-hour /forecast endpoint
    if (!hourly) {
      try {
        // /forecast gives 3-hour steps (list), future points only
        const fUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
        const fResp = await fetch(fUrl);
        if (!fResp.ok) {
          const txt = await fResp.text().catch(()=>"");
          throw new Error(`Forecast API error ${fResp.status}: ${txt}`);
        }
        const fData = await fResp.json();
        const list = fData.list || [];
        if (!list.length) throw new Error("Forecast returned no list data.");

        // Build an hourly array by using current temp (if available in page) plus interpolation
        // Get current temp if present in DOM (fallback if missing)
        let currentTemp = null;
        if (tempEle && typeof tempEle.textContent === "string") {
          const parse = parseFloat((tempEle.textContent || "").replace("°C","").trim());
          if (!Number.isNaN(parse)) currentTemp = parse;
        }
        // If currentTemp is not available, use list[0].main.temp as current
        if (currentTemp === null && list[0] && list[0].main && typeof list[0].main.temp === "number") {
          currentTemp = list[0].main.temp;
        }

        // Create synthetic hourly array: first element = now (currentTemp at now),
        // then fill hourly temps by linear interpolation between forecast 3-hour entries.
        // We'll produce at least 12 recent/future hourly points if possible.
        const hourlySynthetic = [];
        // determine current unix time
        const nowUnix = Math.floor(Date.now()/1000);

        // Insert current point
        if (currentTemp !== null) {
          hourlySynthetic.push({ dt: nowUnix, temp: currentTemp });
        }

        // Convert forecast list to array of {dt, temp}
        const fPoints = list.map(it => ({ dt: it.dt, temp: it.main && it.main.temp }));

        // We'll sample hourly up to next 17 hours (enough to have recent+pred)
        const hoursNeeded = 18;
        for (let h = 1; h <= hoursNeeded; h++) {
          const targetDt = nowUnix + h * 3600;
          // find surrounding forecast points p0 <= targetDt <= p1
          let p0 = null, p1 = null;
          for (let i=0;i<fPoints.length-1;i++){
            if (fPoints[i].dt <= targetDt && fPoints[i+1].dt >= targetDt) {
              p0 = fPoints[i]; p1 = fPoints[i+1]; break;
            }
          }
          // if not found, use closest end points
          if (!p0) {
            if (targetDt <= fPoints[0].dt) { p0 = p1 = fPoints[0]; }
            else { p0 = p1 = fPoints[fPoints.length-1]; }
          }
          // linear interpolation (if p0.dt == p1.dt just use p0.temp)
          let tempVal = p0.temp;
          if (p1 && p1.dt !== p0.dt) {
            const ratio = (targetDt - p0.dt) / (p1.dt - p0.dt);
            tempVal = p0.temp + (p1.temp - p0.temp) * ratio;
          }
          hourlySynthetic.push({ dt: targetDt, temp: tempVal });
        }

        // Use the synthetic hourly array
        hourly = hourlySynthetic;
        microExplain && (microExplain.textContent = "Using 3-hour forecast (interpolated) as OneCall was unavailable.");
      } catch (err) {
        console.error("Forecast fallback error:", err);
        microExplain && (microExplain.textContent = "Micro forecast not available: " + (err.message || err));
        return;
      }
    }

    // Now we have 'hourly' (array of objects {dt, temp}). Build dataset for poly fit
    // Take recent N points for fitting (prefer at least 8-12 points)
    const useN = Math.min(12, hourly.length);
    const recent = hourly.slice(0, useN);
    const x = recent.map((_,i)=>i);
    const y = recent.map(h=>h.temp);

    // Fit polynomial degree 2
    const coeffs = polyFit(x, y, 2); // requires polyFit helper in your script
    const predictCount = 6;
    const preds = [];
    const labels = [];

    for (let i=0;i<useN;i++){
      const dt = new Date(recent[i].dt * 1000);
      labels.push(formatHour(dt));
    }
    const baseDt = new Date(recent[recent.length-1].dt * 1000);
    for (let k=1;k<=predictCount;k++){
      const xi = useN + (k-1);
      const yi = polyEval(coeffs, xi); // polyEval helper required
      preds.push(Math.round(yi * 10) / 10);
      const dt = new Date(baseDt.getTime() + k * 3600 * 1000);
      labels.push(formatHour(dt));
    }

    const dataTemps = y.concat(preds);

    // Render Chart.js
    try {
      if (microChart) { microChart.destroy(); microChart = null; }
      const ctx = microCanvasEl.getContext("2d");
      microChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Temp (observed + predicted) °C',
            data: dataTemps,
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3,
            borderColor: '#ffd54f',
            backgroundColor: (ctx) => {
              const g = ctx.chart.ctx.createLinearGradient(0,0,0,200);
              g.addColorStop(0,'rgba(255,213,79,0.2)');
              g.addColorStop(1,'rgba(255,213,79,0.03)');
              return g;
            }
          }]
        },
        options: { maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>`${v}°C`}}}
      }});
      microExplain && (microExplain.innerHTML = `Model: polynomial deg 2. Coeffs: ${coeffs.map(c=>c.toFixed(3)).join(", ")}. Predicted next ${predictCount} hours.`);
    } catch (chartErr) {
      console.error("Chart render error:", chartErr);
      microExplain && (microExplain.textContent = "Chart render error.");
    }

  } catch (outerErr) {
    console.error("fetchAndPredictMicro outer error:", outerErr);
    microExplain && (microExplain.textContent = "Micro prediction error: " + (outerErr.message || outerErr));
  }
}

// polynomial fit helpers (same as earlier)
// Solve least squares for degree d using normal equations
function polyFit(x, y, degree) {
  const n = x.length;
  const m = degree + 1;
  const A = Array.from({length:n}, (_,i) => Array.from({length:m}, (_,j)=>Math.pow(x[i], j)));
  const ATA = Array.from({length:m}, ()=>Array(m).fill(0));
  const ATy = Array(m).fill(0);
  for (let i=0;i<n;i++){
    for (let r=0;r<m;r++){
      for (let c=0;c<m;c++) ATA[r][c] += A[i][r]*A[i][c];
      ATy[r] += A[i][r]*y[i];
    }
  }
  return solveLinearSystem(ATA, ATy);
}
function polyEval(coeffs, x) { return coeffs.reduce((s,c,i)=>s + c*Math.pow(x,i), 0); }
function solveLinearSystem(A, b) {
  const n = A.length;
  const M = A.map((row,i)=> row.concat([b[i]]));
  for (let i=0;i<n;i++){
    let maxRow = i;
    for (let k=i+1;k<n;k++) if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    let pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) pivot = 1e-12;
    for (let j=i;j<=n;j++) M[i][j] /= pivot;
    for (let r=0;r<n;r++){
      if (r===i) continue;
      const factor = M[r][i];
      for (let c=i;c<=n;c++) M[r][c] -= factor * M[i][c];
    }
  }
  return M.map(row=>row[n]);
}
function formatHour(dt) {
  const h = dt.getHours(); const ampm = h>=12 ? 'pm' : 'am'; let hh = h%12; if (hh===0) hh=12; return `${hh}${ampm}`;
}

/* ------------------ DISEASE / RESPIRATORY RISK ------------------ */
function computeDiseaseRisk({ temp, humidity, desc, aqiIndex }) {
  // weights
  const weights = { aqi:0.5, humidity:0.15, temp:0.15, condition:0.2 };
  const aqiNorm = (aqiIndex===null) ? 0.5 : ((aqiIndex-1)/4);
  let score = 0;
  score += aqiNorm * weights.aqi;

  let humRisk = 0;
  if (humidity <= 30) humRisk = 0.6;
  else if (humidity >= 75) humRisk = 0.7;
  else if (humidity >= 50) humRisk = 0.35;
  else humRisk = 0.15;
  score += humRisk * weights.humidity;

  let tempRisk = 0;
  if (temp <= 10) tempRisk = 0.7;
  else if (temp <= 18) tempRisk = 0.45;
  else if (temp >= 35) tempRisk = 0.5;
  else tempRisk = 0.15;
  score += tempRisk * weights.temp;

  let condRisk = 0;
  if (/smoke|ash/i.test(desc)) condRisk = 0.9;
  else if (/rain|drizzle|thunder|storm/i.test(desc)) condRisk = 0.6;
  else if (/haze|fog|mist/i.test(desc)) condRisk = 0.55;
  else condRisk = 0.15;
  score += condRisk * weights.condition;

  let percent = Math.round(Math.min(1, score) * 100);
  const group = riskGroup.value || "general";
  let adjusted = percent;
  if (group === "asthma") adjusted = Math.round(percent * 1.25);
  if (group === "elderly") adjusted = Math.round(percent * 1.15);
  adjusted = Math.min(100, adjusted);

  let level = "Low", cls = "low";
  if (adjusted >= 70) { level = "High"; cls = "high"; }
  else if (adjusted >= 40) { level = "Moderate"; cls = "medium"; }

  // render
  riskLevelEl.textContent = level;
  riskScoreEl.textContent = `Score: ${adjusted}%`;
  riskLevelEl.className = `risk-badge ${cls}`;
  const advice = generateAdvice(level, group, {aqiIndex, humidity, temp, desc});
  riskAdviceEl.innerHTML = `<ul>${advice.map(a=>`<li>${a}</li>`).join("")}</ul>`;
}
function generateAdvice(level, group, ctx) {
  const adv = [];
  if (level === "High") {
    adv.push("High risk — minimize outdoor exposure.");
    if (group === "asthma") adv.push("Keep inhaler/meds accessible.");
    if (group === "elderly") adv.push("Stay indoors and hydrated.");
    adv.push("If severe symptoms occur, seek medical help.");
  } else if (level === "Moderate") {
    adv.push("Moderate risk — reduce long outdoor activities.");
    adv.push("Consider wearing a mask outdoors.");
    if (ctx.humidity >= 75) adv.push("Indoors: control dampness to reduce mold.");
  } else {
    adv.push("Low risk — standard precautions.");
  }
  if (ctx.aqiIndex !== null && ctx.aqiIndex >= 4) adv.push("AQI is high — avoid traffic-heavy routes.");
  return adv;
}

/* ------------------ Text to Speech for weather (simple) ------------------ */
function speakWeather(temperature, description) {
  const msg = currentLang==="hi" ? `वर्तमान तापमान ${temperature} डिग्री सेल्सियस है, और मौसम ${description} है।` : `The current temperature is ${temperature} degrees Celsius, with ${description}.`;
  const speech = new SpeechSynthesisUtterance(msg);
  speech.lang = currentLang === "hi" ? "hi-IN" : "en-US";
  window.speechSynthesis.speak(speech);
}

/* ------------------ Init on load ------------------ */
window.addEventListener("load", () => {
  initMap();
  applyTranslations();
});
