// Open-Meteo: free, no API key.
import { config } from "../config.js";

const WMO = {
  0: ["Trời quang", "☀"], 1: ["Ít mây", "🌤"], 2: ["Có mây", "⛅"], 3: ["Nhiều mây", "☁"],
  45: ["Sương mù", "🌫"], 48: ["Sương mù", "🌫"],
  51: ["Mưa phùn", "🌦"], 53: ["Mưa phùn", "🌦"], 55: ["Mưa phùn dày", "🌦"],
  61: ["Mưa nhỏ", "🌧"], 63: ["Mưa vừa", "🌧"], 65: ["Mưa to", "🌧"],
  80: ["Mưa rào", "🌦"], 81: ["Mưa rào", "🌧"], 82: ["Mưa rào lớn", "⛈"],
  95: ["Dông", "⛈"], 96: ["Dông, mưa đá", "⛈"], 99: ["Dông, mưa đá", "⛈"],
};
export const describe = (code) => WMO[code] ?? ["—", "·"];

export async function getWeather() {
  const q = new URLSearchParams({
    latitude: config.lat, longitude: config.lon, timezone: config.tz, forecast_days: "3",
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = await res.json();
  const d = j.daily;
  return {
    place: config.place,
    temp: Math.round(j.current.temperature_2m),
    feels: Math.round(j.current.apparent_temperature),
    humidity: j.current.relative_humidity_2m,
    wind: Math.round(j.current.wind_speed_10m),
    code: j.current.weather_code,
    days: d.time.map((t, i) => ({
      date: t, code: d.weather_code[i],
      max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]),
      rain: d.precipitation_probability_max[i],
    })),
    sunrise: d.sunrise[0].slice(11, 16), sunset: d.sunset[0].slice(11, 16),
    uv: Math.round(d.uv_index_max[0]),
  };
}
