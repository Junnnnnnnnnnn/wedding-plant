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

/** 현재 시간을 한국 표준시(KST, UTC+9) 기준으로 가져와 년, 월, 일을 반환 */
export function getKstToday(): { year: number; month: number; day: number } {
  const now = new Date();

  // 한국 시간(KST)은 UTC+9
  // UTC 기준 밀리초 + 9시간 밀리초
  const kstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const kstDate = new Date(kstTime);

  // UTC 메서드를 사용하여 타임존 간섭 없이 날짜 추출
  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1,
    day: kstDate.getUTCDate(),
  };
}

/** 현재 시간을 한국 표준시(KST) 기준의 Date 객체로 반환 (시간은 00:00:00으로 설정됨) */
export function getKstDate(): Date {
  const { year, month, day } = getKstToday();
  return new Date(year, month - 1, day);
}
