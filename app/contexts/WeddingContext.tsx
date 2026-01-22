"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface WeddingData {
  budget: string;
  name: string;
  date?: { year: number; month: number; day: number };
}

interface WeddingContextType {
  weddingData: WeddingData;
  setBudget: (budget: string) => void;
  setName: (name: string) => void;
  setDate: (date: { year: number; month: number; day: number }) => void;
  resetData: () => void;
}

const WeddingContext = createContext<WeddingContextType | undefined>(undefined);

export function WeddingProvider({ children }: { children: ReactNode }) {
  const [weddingData, setWeddingData] = useState<WeddingData>({
    budget: "1000",
    name: "",
  });

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

  return (
    <WeddingContext.Provider
      value={{
        weddingData,
        setBudget,
        setName,
        setDate,
        resetData,
      }}
    >
      {children}
    </WeddingContext.Provider>
  );
}

export function useWedding() {
  const context = useContext(WeddingContext);
  if (context === undefined) {
    throw new Error("useWedding must be used within a WeddingProvider");
  }
  return context;
}
