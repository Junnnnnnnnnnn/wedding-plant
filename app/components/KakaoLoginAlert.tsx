"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApi } from "@/app/contexts/ApiContext";
import { useWedding } from "@/app/contexts/WeddingContext";
import {
  clearToken,
  setToken,
  getShareAfterLogin,
  clearShareAfterLogin,
  getReturnPathAfterLogin,
  clearReturnPathAfterLogin,
  HAS_COMPLETED_GUEST_SETTING_KEY,
  isPlanDataComplete,
  getGuestAgreement,
  clearGuestAgreement,
} from "@/lib/api";
import {
  getGuestScheduleList,
  clearGuestScheduleList,
} from "@/lib/guestSchedule";
import { getKstDateString } from "@/lib/utils";
import NameInputModal from "./NameInputModal";

type KakaoLoginAlertProps = {
  show: boolean;
  /** /main에서 로그인 성공 후 GET /plan/user로 데이터를 불러올 때 호출 */
  onSuccessFromMain?: () => void | Promise<void>;
};

function getKakaoTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return params.get("kakao_token");
}

export default function KakaoLoginAlert({
  show,
  onSuccessFromMain,
}: KakaoLoginAlertProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchBackend, fetchWithAuth, setLoading } = useApi();
  const { weddingData, resetData, setName, setBudget, setDate } = useWedding();
  const shownRef = useRef(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const nameResolveRef = useRef<((name: string) => void) | null>(null);

  /** Shows the name modal and returns a Promise that resolves with the entered name. */
  const waitForName = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      nameResolveRef.current = resolve;
      setLoading(false); // hide global loading so user can see modal
      setShowNameModal(true);
    });
  }, [setLoading]);

  const handleNameComplete = useCallback((name: string) => {
    setShowNameModal(false);
    nameResolveRef.current?.(name);
    nameResolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!show || shownRef.current) return;

    const kakaoToken = getKakaoTokenFromHash();
    if (!kakaoToken) {
      shownRef.current = true;
      clearToken();
      router.replace("/?login_error=1");
      return;
    }

    shownRef.current = true;
    setLoading(true); // 글로벌 로딩 시작

    const run = async () => {
      let fetchedRoomId: number | null = null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetchBackend("/plan/auth/kakao/login", {
          method: "POST",
          body: JSON.stringify({ kakaoToken }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = (await res.json()) as {
          data?: { token?: string };
          result?: boolean;
          error?: string;
        };

        if (res.status === 401) {
          clearTimeout(timeoutId);
          clearToken();
          router.replace("/");
          return;
        }
        if (!res.ok) {
          clearTimeout(timeoutId);
          clearToken();
          router.replace("/?login_error=1");
          return;
        }

        const token = data?.data?.token;
        if (token) {
          clearTimeout(timeoutId);
          setToken(token);
          const url = new URL(window.location.href);
          url.searchParams.delete("kakao_login");
          url.hash = "";
          window.history.replaceState({}, "", url.pathname + url.search);

          // 공유 링크(shareCode) 복원 여부 확인
          const shareCode = getShareAfterLogin();
          if (shareCode) {
            // 이름 없으면 먼저 입력받기
            try {
              const preUserRes = await fetchWithAuth("/plan/user");
              const preUserJson = (await preUserRes.json()) as {
                result?: boolean;
                data?: { name?: string | null };
              };
              if (
                preUserJson.result === true &&
                preUserJson.data &&
                (!preUserJson.data.name || !preUserJson.data.name.trim())
              ) {
                await waitForName();
                setLoading(true); // re-show global loading after name entry
              }
            } catch {
              // name check 실패 시 무시
            }
            try {
              // 방 참여 API 호출
              await fetchWithAuth(`/plan/room/${shareCode}`, {
                method: "POST",
              });
            } catch (err) {
              console.error("Failed to join room after login:", err);
            } finally {
              clearShareAfterLogin();
              resetData();
              router.replace("/plan-list");
            }
          }

          // 저장된 돌아가기 경로 확인
          const returnPath = getReturnPathAfterLogin();
          if (returnPath) {
            clearReturnPathAfterLogin();
            resetData();
            router.replace(returnPath);
            return;
          }

          // GET /plan/user로 플랜 데이터 확인 - weddingDate, budget, name이 있으면 /main에 머물며 사용자·플랜·스케줄 데이터 로드
          try {
            const userRes = await fetchWithAuth("/plan/user");
            const userJson = (await userRes.json()) as {
              result?: boolean;
              data?: {
                weddingDate?: string | null;
                budget?: number | string | null;
                name?: string | null;
                roomId?: number | null;
              };
            };
            if (userJson.result === true && userJson.data) {
              fetchedRoomId = userJson.data.roomId ?? null;
              const { name, weddingDate, budget } = userJson.data;

              // /setting 또는 /main 진입 시 사용할 수 있도록 컨텍스트에 사용자 정보 저장
              if (name) setName(name);
              if (budget) setBudget(String(budget));
              if (weddingDate) {
                const parts = weddingDate.split("-").map(Number);
                if (parts.length === 3 && !parts.some(Number.isNaN)) {
                  setDate({ year: parts[0], month: parts[1], day: parts[2] });
                }
              }

              if (isPlanDataComplete(userJson.data)) {
                // /main에서 로그인 성공 시 메인 페이지에 사용자·플랜·스케줄 등 데이터 갱신 요청
                if (pathname === "/main") {
                  await onSuccessFromMain?.();
                }
                resetData();
                router.replace("/main");
                return;
              }
            }
          } catch {
            // GET 실패 시 기존 로직으로 fallback
          }

          // 개인 플랜이 불완전한 경우 참여 중인 방이 있는지 확인
          try {
            const roomRes = await fetchWithAuth("/plan/room/list");
            const roomJson = (await roomRes.json()) as {
              result?: boolean;
              data?: { total: number };
            };
            if (
              roomJson.result === true &&
              roomJson.data &&
              roomJson.data.total > 0
            ) {
              resetData();
              router.replace("/plan-list");
              return;
            }
          } catch (err) {
            console.error(
              "Failed to fetch room list during login redirect:",
              err,
            );
          }

          // 비로그인 상태로 계획을 짜던 유저가 로그인했는지 여부 확인 (신규 유저 보호용)
          // HAS_COMPLETED_GUEST_SETTING_KEY 플래그가 있어야만 '진짜' 게스트 체험 유저
          const isRealGuestUser =
            pathname === "/main" &&
            typeof window !== "undefined" &&
            sessionStorage.getItem(HAS_COMPLETED_GUEST_SETTING_KEY) === "1";

          if (isRealGuestUser) {
            // 진짜 게스트 유저의 경우 세션의 웨딩 데이터를 백엔드에 POST 후 /main 유지
            if (weddingData.date) {
              let nameToUse = weddingData.name?.trim() || "";
              if (!nameToUse) {
                nameToUse = await waitForName();
                setName(nameToUse);
                setLoading(true);
              }
              const { year, month, day } = weddingData.date;
              const weddingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const guestAgreement = getGuestAgreement();
              try {
                await fetchWithAuth("/plan/setting", {
                  method: "POST",
                  body: JSON.stringify({
                    weddingDate,
                    budget: Number(weddingData.budget) || 0,
                    name: nameToUse,
                    requiredAgreementDate:
                      guestAgreement?.requiredAgreementDate ??
                      getKstDateString(),
                    ...(guestAgreement?.adAgreementDate && {
                      adAgreementDate: guestAgreement.adAgreementDate,
                    }),
                  }),
                });
                clearGuestAgreement();
              } catch {
                // POST 실패해도 /main으로 이동
              }
              const guestPlans = getGuestScheduleList();
              guestPlans.forEach(async (item) => {
                const startDate =
                  item.startDate?.trim() ||
                  new Date().toISOString().slice(0, 10);
                const body: Record<string, unknown> = {
                  categoryName: item.categoryName,
                  title: item.title,
                  payType: item.payType ?? "OTHER",
                  amount: item.amount ?? 0,
                  startDate,
                  location: item.location ?? "",
                  locationLat: item.locationLat ?? 0,
                  locationLng: item.locationLng ?? 0,
                  memo: item.memo ?? "",
                };
                if (fetchedRoomId) {
                  body.roomId = fetchedRoomId;
                }
                if (
                  Array.isArray(item.addCategoryNameList) &&
                  item.addCategoryNameList.length > 0
                ) {
                  body.addCategoryNameList = item.addCategoryNameList;
                }
                try {
                  await fetchWithAuth("/plan/schedule", {
                    method: "POST",
                    body: JSON.stringify(body),
                  });
                } catch {
                  // 개별 플랜 POST 실패 시 건너뜀
                }
              });

              if (guestPlans.length > 0) {
                clearGuestScheduleList();
              }

              await onSuccessFromMain?.();
              resetData();
              router.replace("/main");
              return;
            }
          }

          // 개인 플랜도 없고 참여 중인 방도 없으면 /setting으로
          window.location.href = "/setting";
        } else {
          clearTimeout(timeoutId);
          clearToken();
          router.replace("/?login_error=1");
        }
      } catch {
        clearTimeout(timeoutId);
        clearToken();
        router.replace("/?login_error=1");
      } finally {
        // 모든 로직이 끝났을 때만 (리다이렉트되지 않았을 경우를 대비해 끄지만, 보통 위에서 리다이렉트됨)
        // 실제로는 비동기 리다이렉트 중에도 로딩이 보이도록 하나, 에러 케이스 등에서 멈추는 것 방지
        setLoading(false);
      }
    };

    run();
  }, [
    show,
    fetchBackend,
    fetchWithAuth,
    setLoading,
    router,
    pathname,
    weddingData,
    onSuccessFromMain,
    resetData,
    setBudget,
    setDate,
    setName,
    waitForName,
  ]);

  return (
    <NameInputModal show={showNameModal} onComplete={handleNameComplete} />
  );
}
