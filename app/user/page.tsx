"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import SettingsPage from "../components/SettingsPage";
import BottomTabBar from "../components/BottomTabBar";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import { getToken, clearAllStoredData } from "@/lib/api";
import { getKstDateString } from "@/lib/utils";

/** 예산은 0도 유효한 값이므로 `|| 1000` 대신 빈 값/NaN일 때만 기본값을 쓴다 */
function toBudget(raw: unknown, fallback = 1000): number {
  if (raw === null || raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

interface PlanUserData {
  id: string;
  weddingDate: string;
  budget: number;
  name: string;
  requiredAgreementDate?: string | null;
  adAgreementDate?: string | null;
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
  const { unreadCount } = useNotification();
  const [userData, setUserData] = useState<{
    name: string;
    weddingDate: string;
    budget: number;
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    // 게스트/실패 시 사용할 로컬 기준값 (날짜는 KST 기준)
    const localFallback = () => ({
      name: weddingData.name ?? "",
      weddingDate: weddingData.date
        ? toDateString(weddingData.date)
        : getKstDateString(),
      budget: toBudget(weddingData.budget),
      requiredAgreementDate: null,
      adAgreementDate: null,
    });

    const token = getToken();
    if (!token) {
      setUserData(localFallback());
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
          weddingDate: d.weddingDate ?? getKstDateString(),
          budget: toBudget(d.budget),
          requiredAgreementDate: d.requiredAgreementDate ?? null,
          adAgreementDate: d.adAgreementDate ?? null,
        });
      } else {
        setUserData(localFallback());
      }
    } catch {
      setUserData(localFallback());
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
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  }): Promise<boolean> => {
    const dateStr = user.weddingDate;
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = { year: y, month: m, day: d };
    setName(user.name.trim());
    setDate(date);
    setBudget(String(user.budget));

    if (!getToken()) return true; // 게스트는 로컬 저장으로 끝

    try {
      // PATCH /plan/user 는 requiredAgreementDate·adAgreementDate 를 둘 다
      // "문자열 필수"로 검증한다. GET 응답에는 두 필드가 없어 null을 보내면
      // 항상 400이었고, adAgreementDate 를 채우면 마케팅 미동의자에게도
      // 수신 동의가 기록돼 버린다. 온보딩이 쓰는 /plan/setting 은 같은 값을
      // 갱신하면서 adAgreementDate 생략을 허용하므로 이 경로를 쓴다.
      // (requiredAgreementDate 는 여전히 필수라 값이 없으면 오늘 날짜를 보낸다.
      //  백엔드가 이 필드를 선택 항목으로 바꾸거나 GET 응답에 포함해 주는 것이
      //  근본 해결이다.)
      const res = await fetchWithAuth("/plan/setting", {
        method: "POST",
        body: JSON.stringify({
          weddingDate: dateStr,
          budget: user.budget,
          name: user.name.trim(),
          requiredAgreementDate:
            user.requiredAgreementDate ?? getKstDateString(),
          ...(user.adAgreementDate
            ? { adAgreementDate: user.adAgreementDate }
            : {}),
        }),
      });
      if (!res.ok) return false;
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
      } | null;
      return json?.result === true;
    } catch {
      return false;
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
      <div className="min-h-screen max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col grid-bg z-10 pb-24">
        <SettingsPage
          user={userData}
          onSave={handleSave}
          onClose={handleClose}
          onSignOut={handleSignOut}
        />
        <BottomTabBar unreadCount={unreadCount} />
      </div>
    </div>
  );
}
