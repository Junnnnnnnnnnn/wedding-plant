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
  const kstTime = now.getTime() + 9 * 60 * 60 * 1000;
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

/** 한국 표준시(KST) 기준 오늘 날짜를 "YYYY-MM-DD" 형식으로 반환 */
export function getKstDateString(): string {
  const { year, month, day } = getKstToday();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * KST 오늘부터 대상 날짜까지 남은 "달력 일수". 지난 날짜는 음수.
 *
 * 예전에는 로컬 자정 두 개의 밀리초 차를 나눠 썼는데, 사이에 서머타임
 * 전환이 끼면 차이가 86400000 의 배수가 아니게 되어 하루가 어긋났다
 * (`Math.floor` 를 쓰던 D-day 는 90 대신 89 가 됐다).
 * Date.UTC 는 서머타임이 없어 항상 정확히 나뉜다.
 */
export function getDaysUntil(target: {
  year: number;
  month: number;
  day: number;
}): number {
  const today = getKstToday();
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((targetUtc - todayUtc) / 86400000);
}

/**
 * "HH:mm" 을 "오전 11:00" 으로. 시간이 없으면 빈 문자열을 돌려주므로
 * 부르는 쪽에서 `time && ...` 로 걸러 쓰면 된다.
 *
 * 일정의 시각은 선택 항목이라 대부분 비어 있다. 24시간 표기를 그대로
 * 두면 "14:30" 이 결혼 준비 맥락에서 잘 안 읽혀 오전·오후로 바꾼다.
 */
export function formatKoreanTime(time?: string | null): string {
  const t = time?.trim();
  if (!t) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return "";
  const hour = Number(m[1]);
  const minute = m[2];
  if (hour < 0 || hour > 23) return "";
  const meridiem = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${h12}:${minute}`;
}
