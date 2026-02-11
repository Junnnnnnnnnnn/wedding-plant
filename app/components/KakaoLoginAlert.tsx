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
} from "@/lib/api";
import {
  getGuestScheduleList,
  clearGuestScheduleList,
} from "@/lib/guestSchedule";
import NameInputModal from "./NameInputModal";

type KakaoLoginAlertProps = {
  show: boolean;
  /** /main에서 로그인 성공 후 GET /plan/user로 데이터를 불러올 때 호출 */
  onSuccessFromMain?: () => void | Promise<void>;
  /** true이면 로그인·데이터 로드 중 로딩 모달 표시 (예: / 경로) */
  showLoadingOverlay?: boolean;
};

function getKakaoTokenFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  return params.get("kakao_token");
}

function isPlanDataComplete(data: {
  weddingDate?: string | null;
  budget?: number | string | null;
  name?: string | null;
}): boolean {
  const hasWeddingDate =
    typeof data.weddingDate === "string" && data.weddingDate.trim() !== "";
  const hasName = typeof data.name === "string" && data.name.trim() !== "";
  const hasBudget =
    data.budget != null &&
    (typeof data.budget === "number" ||
      (typeof data.budget === "string" &&
        data.budget.toString().trim() !== ""));
  return Boolean(hasWeddingDate && hasName && hasBudget);
}

export default function KakaoLoginAlert({
  show,
  onSuccessFromMain,
  showLoadingOverlay = false,
}: KakaoLoginAlertProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { fetchBackend, fetchWithAuth, setLoading } = useApi();
  const { weddingData, resetData, setName, setBudget, setDate } = useWedding();
  const shownRef = useRef(false);
  const [processing, setProcessing] = useState(false);
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
    setProcessing(true);
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
          setProcessing(false);
          setLoading(false); // 글로벌 로딩 종료
          clearToken();
          router.replace("/");
          return;
        }
        if (!res.ok) {
          clearTimeout(timeoutId);
          setProcessing(false);
          setLoading(false); // 글로벌 로딩 종료
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
          // @ts-ignore
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
              setLoading(false);
              clearShareAfterLogin();
              setProcessing(false);
              resetData();
              router.replace("/plan-list");
              return;
            }
          }

          // 저장된 돌아가기 경로 확인
          const returnPath = getReturnPathAfterLogin();
          if (returnPath) {
            clearReturnPathAfterLogin();
            setProcessing(false);
            setLoading(false);
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
                setProcessing(false);
                setLoading(false); // 글로벌 로딩 종료
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
              setProcessing(false);
              setLoading(false);
              resetData();
              router.replace("/plan-list");
              return;
            }
          } catch (err) {
            console.error("Failed to fetch room list during login redirect:", err);
          }

          const isFromMain = pathname === "/main";
          if (isFromMain) {
            // /main에서 로그인한 경우: 세션의 웨딩 데이터가 있으면 백엔드에 POST 후 /main 유지, 없으면 /setting으로
            if (weddingData.date) {
              const { year, month, day } = weddingData.date;
              const weddingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              try {
                await fetchWithAuth("/plan/setting", {
                  method: "POST",
                  body: JSON.stringify({
                    weddingDate,
                    budget: Number(weddingData.budget) || 0,
                    name: weddingData.name.trim() || "",
                  }),
                });
              } catch {
                // POST 실패해도 /main으로 이동
              }
              const guestPlans = getGuestScheduleList();
              for (const item of guestPlans) {
                const startDate =
                  item.startDate?.trim() ||
                  new Date().toISOString().slice(0, 10);
                const body: Record<string, any> = {
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
                try {
                  await fetchWithAuth("/plan/schedule", {
                    method: "POST",
                    body: JSON.stringify(body),
                  });
                } catch {
                  // 개별 플랜 POST 실패 시 건너뜀
                }
              }
              if (guestPlans.length > 0) {
                clearGuestScheduleList();
              }
              await onSuccessFromMain?.();
              setProcessing(false);
              setLoading(false); // 글로벌 로딩 종료
              resetData();
              router.replace("/main");
              return;
            }
          }

          // 개인 플랜도 없고 참여 중인 방도 없으면 /setting으로
          setProcessing(false);
          setLoading(false); // 글로벌 로딩 종료
          router.push("/setting");
        } else {
          clearTimeout(timeoutId);
          setProcessing(false);
          setLoading(false); // 글로벌 로딩 종료
          clearToken();
          router.replace("/?login_error=1");
        }
      } catch {
        clearTimeout(timeoutId);
        setProcessing(false);
        setLoading(false); // 글로벌 로딩 종료
        clearToken();
        router.replace("/?login_error=1");
      }
    };

    run();
  }, [
    show,
    fetchBackend,
    fetchWithAuth,
    setLoading, // 추가
    router,
    pathname,
    weddingData,
    onSuccessFromMain,
  ]);

  return <NameInputModal show={showNameModal} onComplete={handleNameComplete} />;
}
