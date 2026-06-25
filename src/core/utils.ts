export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const pickRandom = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

export const getLocalDateKey = (time: number) => {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isSameLocalDay = (left: number, right: number) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

export const isNightTime = (time: number) => {
  const hour = new Date(time).getHours();
  return hour >= 22 || hour < 7;
};

export const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};
