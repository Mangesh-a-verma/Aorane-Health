/**
 * Weather context builder — uses OpenWeatherMap free tier
 * Falls back to season-based context if API key not set
 */

function getIndianSeason(month: number): string {
  if ([12, 1, 2].includes(month)) return "Winter (Sardi) — cold and dry";
  if ([3, 4, 5].includes(month)) return "Summer (Garmi) — hot, stay hydrated";
  if ([6, 7, 8, 9].includes(month)) return "Monsoon (Barsaat) — humid, avoid raw foods";
  return "Autumn (Sharad) — mild and pleasant";
}

export async function getWeatherContext(city: string, state?: string): Promise<string> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const month = new Date().getMonth() + 1;
  const season = getIndianSeason(month);

  if (!apiKey) {
    return `Location: ${city || "India"}${state ? ", " + state : ""}. Season: ${season}.`;
  }

  try {
    const query = encodeURIComponent(`${city}${state ? "," + state : ""},IN`);
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${query}&units=metric&appid=${apiKey}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error("Weather API error");
    const data = await res.json() as {
      main?: { temp?: number; humidity?: number };
      weather?: { description?: string }[];
    };
    const temp = data.main?.temp ?? null;
    const humidity = data.main?.humidity ?? null;
    const desc = data.weather?.[0]?.description ?? season;
    return `Location: ${city}, ${state ?? "India"}. Weather: ${desc}, ${temp !== null ? temp + "°C" : ""}, Humidity: ${humidity !== null ? humidity + "%" : "moderate"}. Season: ${season}.`;
  } catch {
    return `Location: ${city || "India"}${state ? ", " + state : ""}. Season: ${season}.`;
  }
}
