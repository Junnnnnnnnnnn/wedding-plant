"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import RouteSkeletonScreen from "@/app/components/RouteSkeleton";
import SettingsPage from "../components/SettingsPage";
import AppShell from "../components/AppShell";
import { useWedding } from "../contexts/WeddingContext";
import { useApi } from "../contexts/ApiContext";
import { useNotification } from "../contexts/NotificationContext";
import { getToken, clearAllStoredData } from "@/lib/api";
import { getKstDateString } from "@/lib/utils";
import { findBoundRoom } from "@/lib/boundRoom";

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
  weddingVenue?: string | null;
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
    weddingVenue?: string | null;
    budget: number;
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  /*
    배우자로 귀속된 방의 방장 이름. 있으면 **결혼식 날짜·예식장·예산이 내
    기록이 아니라 방장 것**이다 — 홈·보드·예산이 이미 그 방을 보고 있는데
    (`lib/boundRoom.ts`) 이 화면만 내 기록을 보여 주면, 같은 사람에게 서로
    다른 예산과 D-day 가 동시에 뜬다. 결혼식은 한 번이라 날짜도 예식장도
    예산도 하나다.

    이름만 내 것이다. 방 안에서 나를 가리키는 값이라 각자 다른 게 맞다.
  */
  const [boundOwnerName, setBoundOwnerName] = useState<string | null>(null);
  /*
    내 기록의 원래 값. 귀속되어 화면에는 방장 값이 떠도 저장할 때는 이걸
    그대로 돌려보낸다 — 안 그러면 이름만 바꿔 저장해도 내 예산·날짜가
    방장 값으로 덮어써진다(귀속이 풀리면 그 값이 다시 내 플랜이 된다).
  */
  const [ownRecord, setOwnRecord] = useState<{
    weddingDate: string;
    weddingVenue?: string | null;
    budget: number;
  } | null>(null);
  /* 게스트에게는 지울 계정이 없다. 렌더 중에 getToken() 을 읽으면 서버
     렌더와 값이 달라 하이드레이션이 어긋나므로 상태로 들고 있는다. */
  const [isMember, setIsMember] = useState(false);

  /**
   * 배우자로 귀속된 방의 플랜. 귀속이 아니면 `null`.
   *
   * 판단 근거는 `/plan/room/list` 의 권한 하나뿐이고(`findBoundRoom`),
   * 값은 `GET /plan/room/{roomId}` — 방장의 날짜·예산·예식장이다.
   * **실패하면 조용히 `null`** 이다. 내 기록을 그대로 보여 주는 쪽이,
   * 아무것도 못 보여 주는 것보다 낫다.
   */
  const fetchBoundPlan = useCallback(async (): Promise<{
    ownerName: string;
    weddingDate: string;
    weddingVenue: string | null;
    budget: number;
  } | null> => {
    try {
      const listRes = await fetchWithAuth("/plan/room/list", {
        skipLoading: true,
      });
      if (!listRes.ok) return null;
      const listJson = (await listRes.json().catch(() => null)) as {
        data?: { list?: Array<{ roomId?: number | null }> };
      } | null;
      const bound = findBoundRoom(listJson?.data?.list);
      if (bound?.roomId == null) return null;

      const roomRes = await fetchWithAuth(`/plan/room/${bound.roomId}`, {
        skipLoading: true,
      });
      if (!roomRes.ok) return null;
      const roomJson = (await roomRes.json().catch(() => null)) as {
        result?: boolean;
        data?: {
          name?: string | null;
          weddingDate?: string | null;
          weddingVenue?: string | null;
          budget?: number | null;
        };
      } | null;
      if (roomJson?.result !== true || !roomJson.data) return null;
      return {
        ownerName: (roomJson.data.name ?? "").trim(),
        weddingDate: roomJson.data.weddingDate ?? "",
        weddingVenue: roomJson.data.weddingVenue ?? null,
        budget: toBudget(roomJson.data.budget),
      };
    } catch {
      return null;
    }
  }, [fetchWithAuth]);

  const fetchUser = useCallback(async () => {
    // 게스트/실패 시 사용할 로컬 기준값 (날짜는 KST 기준)
    const localFallback = () => ({
      name: weddingData.name ?? "",
      weddingDate: weddingData.date
        ? toDateString(weddingData.date)
        : getKstDateString(),
      budget: toBudget(weddingData.budget),
      // 예식장은 백엔드에만 있다. 게스트는 넣을 곳이 없어 비워 둔다.
      weddingVenue: null,
      requiredAgreementDate: null,
      adAgreementDate: null,
    });

    const token = getToken();
    if (!token) {
      setIsMember(false);
      setUserData(localFallback());
      setLoading(false);
      return;
    }
    setIsMember(true);
    try {
      const res = await fetchWithAuth("/plan/user", { skipLoading: true });
      const json = (await res.json()) as {
        result?: boolean;
        data?: PlanUserData;
      };
      const mine =
        json.result === true && json.data
          ? {
              name: json.data.name ?? "",
              weddingDate: json.data.weddingDate ?? getKstDateString(),
              weddingVenue: json.data.weddingVenue ?? null,
              budget: toBudget(json.data.budget),
              requiredAgreementDate: json.data.requiredAgreementDate ?? null,
              adAgreementDate: json.data.adAgreementDate ?? null,
            }
          : localFallback();
      setOwnRecord({
        weddingDate: mine.weddingDate,
        weddingVenue: mine.weddingVenue,
        budget: mine.budget,
      });

      const bound = await fetchBoundPlan();
      setBoundOwnerName(bound?.ownerName ?? null);
      setUserData(
        bound
          ? {
              ...mine,
              weddingDate: bound.weddingDate || mine.weddingDate,
              weddingVenue: bound.weddingVenue,
              budget: bound.budget,
            }
          : mine,
      );
    } catch {
      setUserData(localFallback());
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, fetchBoundPlan, weddingData]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleSave = async (user: {
    name: string;
    weddingDate: string;
    weddingVenue?: string | null;
    budget: number;
    requiredAgreementDate?: string | null;
    adAgreementDate?: string | null;
  }): Promise<boolean> => {
    /*
      귀속된 사람의 화면에는 방장의 날짜·예식장·예산이 떠 있다. 그대로
      저장하면 **내 기록이 방장 값으로 덮어써진다** — 함께하기를 그만두면
      그 값이 내 플랜이 되므로, 보이기만 할 뿐 저장은 원래 내 값으로 한다.
    */
    const toSave =
      boundOwnerName && ownRecord ? { ...user, ...ownRecord } : user;

    const dateStr = toSave.weddingDate;
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = { year: y, month: m, day: d };
    setName(toSave.name.trim());
    setDate(date);
    setBudget(String(toSave.budget));

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
          budget: toSave.budget,
          name: toSave.name.trim(),
          // 항상 보낸다. 빈 문자열이면 백엔드가 지운다 — 지우기를 표현할
          // 방법이 없으면 한 번 넣은 예식장을 못 빼게 된다.
          weddingVenue: (toSave.weddingVenue ?? "").trim(),
          requiredAgreementDate:
            toSave.requiredAgreementDate ?? getKstDateString(),
          ...(toSave.adAgreementDate
            ? { adAgreementDate: toSave.adAgreementDate }
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

  /**
   * 회원 탈퇴. 서버에서 계정이 지워진 뒤에만 로컬을 비운다 — 순서를 바꾸면
   * 요청이 실패했을 때 계정은 살아 있는데 이 기기에서만 로그아웃된 상태가
   * 되고, 사용자는 탈퇴된 줄 안다.
   */
  const handleWithdraw = async (): Promise<boolean> => {
    try {
      const res = await fetchWithAuth("/plan/user", { method: "DELETE" });
      if (!res.ok) return false;
      // 이 엔드포인트는 본문을 내지 않는다. 본문이 있고 result 가 false 일
      // 때만 실패로 본다.
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
      } | null;
      if (json && json.result === false) return false;
    } catch {
      return false;
    }

    clearAllStoredData();
    resetData();
    router.replace("/?api_error=0");
    return true;
  };

  /*
    받는 동안 셸째로 뼈대를 낸다. 예전에는 흰 화면 가운데 스피너만 돌아서
    레일·탭바까지 사라졌다 — 메뉴를 누르면 앱이 한 번 꺼졌다 켜지는 것처럼
    보였다. 전역 오버레이도 덮지 않게 요청에 `skipLoading` 을 준다.
  */
  if (loading || !userData) {
    return <RouteSkeletonScreen pathname="/user" />;
  }

  return (
    <AppShell
      activeTab="settings"
      activeRailView="settings"
      unreadCount={unreadCount}
    >
      <SettingsPage
        user={userData}
        boundOwnerName={boundOwnerName}
        onSave={handleSave}
        onClose={handleClose}
        onSignOut={handleSignOut}
        onWithdraw={isMember ? handleWithdraw : undefined}
      />
    </AppShell>
  );
}
