type ResolvedProjectWeather = {
  label: string;
  rainRisk: string;
  source: string;
  temperature: string;
  wind: string;
};

type CachedWeatherEntry = {
  expiresAt: number;
  value: ResolvedProjectWeather;
};

const weatherCache = new Map<string, CachedWeatherEntry>();
const weatherCacheDurationMs = 30 * 60 * 1000;

const weatherLabelByCode: Record<number, string> = {
  0: "Ensoleille",
  1: "Peu nuageux",
  2: "Nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine faible",
  53: "Bruine",
  55: "Bruine forte",
  56: "Bruine verglacante",
  57: "Bruine verglacante forte",
  61: "Pluie faible",
  63: "Pluie",
  65: "Pluie forte",
  66: "Pluie verglacante",
  67: "Pluie verglacante forte",
  71: "Neige faible",
  73: "Neige",
  75: "Neige forte",
  77: "Grains de neige",
  80: "Averses faibles",
  81: "Averses",
  82: "Averses fortes",
  85: "Averses de neige",
  86: "Averses de neige fortes",
  95: "Orage",
  96: "Orage avec grele",
  99: "Orage violent",
};

function toWeatherLabel(code: number | undefined) {
  if (code === undefined || Number.isNaN(code)) {
    return "Conditions variables";
  }

  return weatherLabelByCode[code] ?? "Conditions variables";
}

function buildSearchQuery(location: string) {
  const cleaned = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  return cleaned || location.trim();
}

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveProjectWeather(input: {
  fallback: ResolvedProjectWeather;
  location: string;
  projectId: string;
}) {
  const location = input.location.trim();
  if (!location) {
    return input.fallback;
  }

  const cached = weatherCache.get(input.projectId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const searchQuery = buildSearchQuery(location);
    const geocoding = await fetchJson<{
      results?: Array<{
        country_code?: string;
        latitude: number;
        longitude: number;
        name: string;
      }>;
    }>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=fr&format=json&countryCode=TN`,
    );

    const match =
      geocoding.results?.[0] ??
      (
        await fetchJson<{
          results?: Array<{
            latitude: number;
            longitude: number;
            name: string;
          }>;
        }>(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=fr&format=json`,
        )
      ).results?.[0];

    if (!match) {
      return input.fallback;
    }

    const forecast = await fetchJson<{
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
      daily?: {
        precipitation_probability_max?: number[];
      };
    }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${match.latitude}&longitude=${match.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=precipitation_probability_max&forecast_days=1&timezone=auto`,
    );

    const value: ResolvedProjectWeather = {
      label: toWeatherLabel(forecast.current?.weather_code),
      rainRisk:
        forecast.daily?.precipitation_probability_max?.[0] !== undefined
          ? `${Math.round(forecast.daily.precipitation_probability_max[0])}%`
          : input.fallback.rainRisk,
      source: `Open-Meteo - ${match.name}`,
      temperature:
        forecast.current?.temperature_2m !== undefined
          ? `${Math.round(forecast.current.temperature_2m)} C`
          : input.fallback.temperature,
      wind:
        forecast.current?.wind_speed_10m !== undefined
          ? `${Math.round(forecast.current.wind_speed_10m)} km/h`
          : input.fallback.wind,
    };

    weatherCache.set(input.projectId, {
      expiresAt: Date.now() + weatherCacheDurationMs,
      value,
    });

    return value;
  } catch {
    return input.fallback;
  }
}
