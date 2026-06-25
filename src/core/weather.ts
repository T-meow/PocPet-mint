import { t } from '../i18n';
import type { WeatherType } from './petTypes';
import { getLocalDateKey, hashString } from './utils';

export const weatherTypes: readonly WeatherType[] = ['sunny', 'cloudy', 'rainy', 'breezy'];

export const weatherInfo: Record<WeatherType, { label: string; summary: string }> = {
  sunny: {
    label: t('pet.weather.sunny.label'),
    summary: t('pet.weather.sunny.summary'),
  },
  cloudy: {
    label: t('pet.weather.cloudy.label'),
    summary: t('pet.weather.cloudy.summary'),
  },
  rainy: {
    label: t('pet.weather.rainy.label'),
    summary: t('pet.weather.rainy.summary'),
  },
  breezy: {
    label: t('pet.weather.breezy.label'),
    summary: t('pet.weather.breezy.summary'),
  },
};

export const weatherTypeSet = new Set<WeatherType>(weatherTypes);

export const getWeatherForDate = (time: number): WeatherType => {
  const dateKey = getLocalDateKey(time);
  return weatherTypes[hashString(`weather-${dateKey}`) % weatherTypes.length];
};
