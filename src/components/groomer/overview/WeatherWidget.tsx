import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Sun, CloudRain, Snowflake, CloudDrizzle, CloudLightning, Wind } from "lucide-react";

function getWeatherIcon(code: number) {
  if (code <= 1) return <Sun className="h-8 w-8 text-amber-500" />;
  if (code <= 3) return <Cloud className="h-8 w-8 text-slate-400" />;
  if (code <= 49) return <Cloud className="h-8 w-8 text-slate-400" />;
  if (code <= 57) return <CloudDrizzle className="h-8 w-8 text-blue-400" />;
  if (code <= 67) return <CloudRain className="h-8 w-8 text-blue-500" />;
  if (code <= 77) return <Snowflake className="h-8 w-8 text-sky-300" />;
  if (code <= 82) return <CloudRain className="h-8 w-8 text-blue-600" />;
  if (code <= 99) return <CloudLightning className="h-8 w-8 text-purple-500" />;
  return <Wind className="h-8 w-8 text-slate-400" />;
}

function getConditionText(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 49) return "Overcast";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Heavy rain";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

function getGroomingTip(code: number, temp: number): string {
  if (code >= 51 && code <= 82) return "Wet dogs today — have towels ready 🌧️";
  if (code >= 71 && code <= 77) return "Snowy conditions — dogs may need extra drying ❄️";
  if (temp >= 25) return "Keep water available for dogs today ☀️";
  if (temp <= 5) return "Dogs may be reluctant — extra patience today ❄️";
  return "Great grooming weather today! 🐾";
}

export function WeatherWidget() {
  const { data: weather } = useQuery({
    queryKey: ["hornchurch-weather"],
    queryFn: async () => {
      // Hornchurch coordinates: 51.5565, 0.2128
      const res = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=51.5565&longitude=0.2128&current=temperature_2m,weather_code&timezone=Europe%2FLondon"
      );
      if (!res.ok) throw new Error("Weather fetch failed");
      const data = await res.json();
      return {
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weather_code as number,
      };
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  if (!weather) return null;

  return (
    <Card className="bg-gradient-to-br from-sky-50/80 to-blue-50/50 dark:from-sky-950/20 dark:to-blue-950/10 border-sky-200/40">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          {getWeatherIcon(weather.code)}
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{weather.temp}°C</span>
              <span className="text-sm text-muted-foreground">{getConditionText(weather.code)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Hornchurch, RM11</p>
          </div>
        </div>
        <p className="text-sm text-foreground/80 mt-3 p-2.5 rounded-lg bg-white/50 dark:bg-white/5">
          {getGroomingTip(weather.code, weather.temp)}
        </p>
      </CardContent>
    </Card>
  );
}
