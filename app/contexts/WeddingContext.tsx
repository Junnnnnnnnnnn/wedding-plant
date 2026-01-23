"use client";

import { createContext, useContext, useState, ReactNode, useMemo } from "react";

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

export function WeddingProvider({ children }: { children: ReactNode }) {
  const [weddingData, setWeddingData] = useState<WeddingData>({
    budget: "1000",
    name: "",
  });

  // 추후 API로 관리할 user 정보
  const [user, setUser] = useState<User | null>(null);

  const setBudget = (budget: string) => {
    setWeddingData((prev) => ({ ...prev, budget }));
  };

  const setName = (name: string) => {
    setWeddingData((prev) => ({ ...prev, name }));
  };

  const setDate = (date: { year: number; month: number; day: number }) => {
    setWeddingData((prev) => ({ ...prev, date }));
  };

  const resetData = () => {
    setWeddingData({
      budget: "1000",
      name: "",
    });
  };

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
    [weddingData, user],
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
