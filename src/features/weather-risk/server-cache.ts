import type { FieldWeather, WeatherStorage } from "./weather";

/** Process-local weather cache for Route Handlers (1h TTL lives in weather.ts). */
const memory = new Map<string, string>();

export const memoryWeatherStorage: WeatherStorage = {
  async getItem(key) {
    return memory.get(key) ?? null;
  },
  async setItem(key, value) {
    memory.set(key, value);
  },
};

export type { FieldWeather };
