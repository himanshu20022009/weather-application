// Use your OpenWeather API key
const apiKey = "20da423906ccf27bec8c2d81c8f4a2eb";

let forecastChart = null;

const formEle = document.getElementById("forecast-form");
const cityInputEle = document.getElementById("forecast-city");
const cityLabelEle = document.getElementById("cityLabel");
const statusEle = document.getElementById("statusMessage");
const forecastMessageEle = document.getElementById("forecastMessage");
const canvas = document.getElementById("forecastChart");

console.log("forecast.js loaded");

// -------- API CALL --------
async function getForecastDataByCity(city) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
            city
        )}&appid=${apiKey}&units=metric`;

        console.log("Calling forecast API:", url);
        const response = await fetch(url);

        console.log("Forecast response:", response.status, response.statusText);

        if (!response.ok) {
            if (response.status === 404) throw new Error("City not found. Try another name.");
            if (response.status === 401) throw new Error("Invalid API key.");
            throw new Error("Error fetching forecast data.");
        }

        const data = await response.json();
        console.log("Forecast JSON:", data);
        return data.list; // 3-hour forecast entries
    } catch (err) {
        console.error("Forecast error:", err);
        statusEle.textContent = err.message;
        return [];
    }
}

// -------- HELPERS --------
function formatTimeLabel(dtTxt) {
    const timePart = dtTxt.split(" ")[1]; // "HH:MM:SS"
    const [hourStr] = timePart.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "pm" : "am";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour} ${ampm}`;
}

// -------- CHART RENDERING --------
function renderForecastChartHourly(forecastList) {
    if (!canvas) return;

    if (!forecastList || forecastList.length === 0) {
        forecastMessageEle.textContent = "No forecast data available.";
        if (forecastChart) {
            forecastChart.destroy();
            forecastChart = null;
        }
        return;
    }

    forecastMessageEle.textContent = "";

    // Next 24 hours (8 x 3-hour points)
    const points = forecastList.slice(0, 8);

    const labels = points.map(p => formatTimeLabel(p.dt_txt));
    const temps = points.map(p => Math.round(p.main.temp));

    // Tight y-axis range around the temps
    let minTemp = Math.min(...temps);
    let maxTemp = Math.max(...temps);
    const padding = 2;

    // prevent weird ranges if all temps same
    if (minTemp === maxTemp) {
        minTemp -= 2;
        maxTemp += 2;
    } else {
        minTemp -= padding;
        maxTemp += padding;
    }

    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgba(255, 204, 0, 0.7)");
    gradient.addColorStop(1, "rgba(255, 204, 0, 0.05)");

    if (forecastChart) {
        forecastChart.destroy();
    }

    forecastChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Temp (°C)",
                data: temps,
                borderColor: "#ffcc00",
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: "#ffcc00",
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.parsed.y}°C`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: "#ffffff",
                        maxRotation: 0,
                        autoSkip: false
                    }
                },
                y: {
                    grid: { display: false },
                    beginAtZero: false, // 🔴 do NOT force zero
                    min: minTemp, // 🔒 lock lower bound
                    max: maxTemp, // 🔒 lock upper bound
                    ticks: {
                        color: "#ffffff",
                        stepSize: 1,
                        callback: value => `${value}°C`
                    }
                }
            }
        }
    });
}

// -------- FORM HANDLER --------
formEle.addEventListener("submit", async(e) => {
    e.preventDefault();
    const city = cityInputEle.value.trim();
    if (!city) {
        statusEle.textContent = "Please enter a city name.";
        return;
    }

    statusEle.textContent = "Loading forecast...";
    cityLabelEle.textContent = "";
    forecastMessageEle.textContent = "";

    const list = await getForecastDataByCity(city);

    if (list.length > 0) {
        statusEle.textContent = "";
        cityLabelEle.textContent = `City: ${city}`;
        renderForecastChartHourly(list);
    } else {
        renderForecastChartHourly([]);
    }
});

// Focus input on load
window.addEventListener("load", () => {
    console.log("Forecast page loaded");
    if (cityInputEle) cityInputEle.focus();
});