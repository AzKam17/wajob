import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value: string | number | null | undefined, includeTime = false): string {
  if (!value) return '-';

  let date: Date;

  if (typeof value === 'string') {
    // Check if it's a numeric string (Unix timestamp)
    const numericValue = Number(value);
    if (!isNaN(numericValue) && numericValue > 0) {
      // If it's a small number, it's likely seconds; if large, milliseconds
      date = new Date(numericValue > 10000000000 ? numericValue : numericValue * 1000);
    } else {
      // Try parsing as ISO string
      date = new Date(value);
    }
  } else if (typeof value === 'number') {
    // If it's a small number, it's likely seconds; if large, milliseconds
    date = new Date(value > 10000000000 ? value : value * 1000);
  } else {
    return '-';
  }

  if (isNaN(date.getTime())) {
    return '-';
  }

  return includeTime ? date.toLocaleString() : date.toLocaleDateString();
}

export function formatTime(value: string | number | null | undefined): string {
  if (!value) return '-';

  let date: Date;

  if (typeof value === 'string') {
    const numericValue = Number(value);
    if (!isNaN(numericValue) && numericValue > 0) {
      date = new Date(numericValue > 10000000000 ? numericValue : numericValue * 1000);
    } else {
      date = new Date(value);
    }
  } else if (typeof value === 'number') {
    date = new Date(value > 10000000000 ? value : value * 1000);
  } else {
    return '-';
  }

  if (isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
