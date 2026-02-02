"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from "react";

export interface User {
  id: string;
  name: string;
  email: string;
}

interface WeddingData {
  budget: string;
  name: string;
  date?: { year: number; month: number; day: number };
}

interface WeddingContextType {
  weddingData: WeddingData;
  user: User | null;
  setBudget: (budget: string) => void;
  setName: (name: string) => void;
  setDate: (date: { year: number; month: number; day: number }) => void;
  setUser: (user: User | null) => void;
  resetData: () => void;
}

const WeddingContext = createContext<WeddingContextType | undefined>(undefined);

const WEDDING_DATA_KEY = "weddingData";
const LEGACY_WEDDING_DATE_KEY = "weddingDate";

function loadWeddingData(): WeddingData {
  if (typeof window === "undefined") {
    return { budget: "1000", name: "" };
  }
  try {
    const raw = sessionStorage.getItem(WEDDING_DATA_KEY);
    let parsed: Record<string, unknown> | null = null;

    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object") parsed = p as Record<string, unknown>;
    }

    // 이전에 weddingDate 단일 키로 저장된 값 마이그레이션
    if (!parsed?.date) {
      const legacy = sessionStorage.getItem(LEGACY_WEDDING_DATE_KEY);
      if (legacy) {
        try {
          const legacyDate = JSON.parse(legacy) as unknown;
          if (
            legacyDate &&
            typeof legacyDate === "object" &&
            "year" in legacyDate &&
            "month" in legacyDate &&
            "day" in legacyDate
          ) {
            const d = legacyDate as {
              year: number;
              month: number;
              day: number;
            };
            parsed = {
              ...parsed,
              budget: parsed?.budget ?? "1000",
              name: parsed?.name ?? "",
              date: { year: d.year, month: d.month, day: d.day },
            };
            sessionStorage.setItem(WEDDING_DATA_KEY, JSON.stringify(parsed));
            sessionStorage.removeItem(LEGACY_WEDDING_DATE_KEY);
          }
        } catch {
          // ignore
        }
      }
    }

    if (!parsed) return { budget: "1000", name: "" };
    const p = parsed;
    const budget = typeof p.budget === "string" ? p.budget : "1000";
    const name = typeof p.name === "string" ? p.name : "";
    let date: WeddingData["date"];
    if (
      p.date &&
      typeof p.date === "object" &&
      p.date !== null &&
      "year" in p.date &&
      "month" in p.date &&
      "day" in p.date
    ) {
      const d = p.date as { year: unknown; month: unknown; day: unknown };
      if (
        typeof d.year === "number" &&
        typeof d.month === "number" &&
        typeof d.day === "number"
      ) {
        date = { year: d.year, month: d.month, day: d.day };
      }
    }
    return { budget, name, date };
  } catch {
    return { budget: "1000", name: "" };
  }
}

function saveWeddingData(data: WeddingData) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(WEDDING_DATA_KEY, JSON.stringify(data));
}

export function WeddingProvider({ children }: { children: ReactNode }) {
  const [weddingData, setWeddingData] = useState<WeddingData>(loadWeddingData);

  // 추후 API로 관리할 user 정보
  const [user, setUser] = useState<User | null>(null);

  const setBudget = useCallback((budget: string) => {
    setWeddingData((prev) => {
      const next = { ...prev, budget };
      saveWeddingData(next);
      return next;
    });
  }, []);

  const setName = useCallback((name: string) => {
    setWeddingData((prev) => {
      const next = { ...prev, name };
      saveWeddingData(next);
      return next;
    });
  }, []);

  const setDate = useCallback(
    (date: { year: number; month: number; day: number }) => {
      setWeddingData((prev) => {
        const next = { ...prev, date };
        saveWeddingData(next);
        return next;
      });
    },
    [],
  );

  const resetData = useCallback(() => {
    const initial = { budget: "1000", name: "" };
    setWeddingData(initial);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(WEDDING_DATA_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      weddingData,
      user,
      setBudget,
      setName,
      setDate,
      setUser,
      resetData,
    }),
    [weddingData, user, setBudget, setName, setDate, setUser, resetData],
  );

  return (
    <WeddingContext.Provider value={value}>{children}</WeddingContext.Provider>
  );
}

export function useWedding() {
  const context = useContext(WeddingContext);
  if (context === undefined) {
    throw new Error("useWedding must be used within a WeddingProvider");
  }
  return context;
}
