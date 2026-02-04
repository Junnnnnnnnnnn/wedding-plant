"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SettingsPage from "../components/SettingsPage";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { getToken, clearAllStoredData } from "@/lib/api";

interface PlanUserData {
  id: string;
  weddingDate: string;
  budget: number;
  name: string;
}

function toDateString(d: { year: number; month: number; day: number }) {
  const m = String(d.month).padStart(2, "0");
  const day = String(d.day).padStart(2, "0");
  return `${d.year}-${m}-${day}`;
}

export default function UserPage() {
  const router = useRouter();
  const { weddingData, setBudget, setName, setDate, resetData } = useWedding();
  const { fetchWithAuth } = useApi();
  const [userData, setUserData] = useState<{
    name: string;
    weddingDate: string;
    budget: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUserData({
        name: weddingData.name ?? "",
        weddingDate: weddingData.date
          ? toDateString(weddingData.date)
          : new Date().toISOString().slice(0, 10),
        budget: Number(weddingData.budget) || 1000,
      });
      setLoading(false);
      return;
    }
    try {
      const res = await fetchWithAuth("/plan/user");
      const json = (await res.json()) as {
        result?: boolean;
        data?: PlanUserData;
      };
      if (json.result === true && json.data) {
        const d = json.data;
        setUserData({
          name: d.name ?? "",
          weddingDate: d.weddingDate ?? new Date().toISOString().slice(0, 10),
          budget: d.budget ?? 1000,
        });
      } else {
        setUserData({
          name: weddingData.name ?? "",
          weddingDate: weddingData.date
            ? toDateString(weddingData.date)
            : new Date().toISOString().slice(0, 10),
          budget: Number(weddingData.budget) || 1000,
        });
      }
    } catch {
      setUserData({
        name: weddingData.name ?? "",
        weddingDate: weddingData.date
          ? toDateString(weddingData.date)
          : new Date().toISOString().slice(0, 10),
        budget: Number(weddingData.budget) || 1000,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, weddingData]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSave = async (user: {
    name: string;
    weddingDate: string;
    budget: number;
  }) => {
    const dateStr = user.weddingDate;
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = { year: y, month: m, day: d };
    setName(user.name.trim());
    setDate(date);
    setBudget(String(user.budget));

    if (getToken()) {
      try {
        await fetchWithAuth("/plan/user", {
          method: "PATCH",
          body: JSON.stringify({
            weddingDate: dateStr,
            budget: user.budget,
            name: user.name.trim(),
          }),
        });
      } catch {
        // ignore
      }
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleSignOut = () => {
    clearAllStoredData();
    resetData();
    router.replace("/?api_error=0");
  };

  if (loading || !userData) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fcfbfc]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ee2b8c] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#fcfbfc]">
      <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg">
        <SettingsPage
          user={userData}
          onSave={handleSave}
          onClose={handleClose}
          onSignOut={handleSignOut}
        />
      </div>
    </div>
  );
}
