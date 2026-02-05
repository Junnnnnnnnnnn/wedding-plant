import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export default function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "YYYY-MM-DD" 문자열을 로컬 날짜로 파싱 (타임존 오차 방지) */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length < 10) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
