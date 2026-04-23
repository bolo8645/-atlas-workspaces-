import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatAscuDate(year: number, month?: number | null) {
  const suffix = year === 0 ? "First Fall" : `AF ${year}`;
  if (!month) return suffix;
  return `${suffix}.${month.toString().padStart(2, "0")}`;
}
