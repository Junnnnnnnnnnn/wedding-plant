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
import CustomAlertModal from "./CustomAlertModal";

type KakaoLoginAlertProps = {
  show: boolean;
  /** /main에서 로그인 성공 후 GET /plan/user로 데이터를 불러올 때 호출 */
  onSuccessFromMain?: () => void | Promise<void>;
};

/**
 * 콜백이 httpOnly 쿠키에 넣어둔 카카오 access_token 을 회수한다.
 * 예전에는 URL fragment(#kakao_token=)로 받았는데, 그 값이 서버의
 * Location 응답 헤더에 평문으로 실려 액세스 로그에 남았다.
 */
async function fetchKakaoToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/kakao/token", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { kakaoToken?: string };
    return json.kakaoToken?.trim() || null;
  } catch {
    return null;
  }
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
  /** 마이그레이션 중 일부/전체가 실패했을 때 사용자에게 알릴 문구 */
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
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

    shownRef.current = true;
    setLoading(true); // 글로벌 로딩 시작

    const run = async () => {
      const kakaoToken = await fetchKakaoToken();
      if (!kakaoToken) {
        clearToken();
        setLoading(false);
        router.replace("/?login_error=1");
        return;
      }
      let fetchedRoomId: number | null = null;
      /** 게스트 설정(예산·날짜·이름)을 이 로그인에서 이관했는지 */
      let migratedSetting = false;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetchBackend("/plan/auth/kakao/login", {
          method: "POST",
          body: JSON.stringify({ kakaoToken }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // 상태 코드를 파싱보다 먼저 본다. 게이트웨이가 502·HTML 을 주면
        // res.json() 이 먼저 throw 되어 아래 분기에 도달하지 못했다.
        if (!res.ok) {
          clearToken();
          // 401 도 그냥 랜딩으로 보내면 사용자가 이유를 몰라 무한 재시도한다
          router.replace("/?login_error=1");
          return;
        }

        const data = (await res.json().catch(() => null)) as {
          data?: { token?: string };
          result?: boolean;
          error?: string;
        } | null;

        const token = data?.data?.token;
        if (token) {
          clearTimeout(timeoutId);
          setToken(token);
          const url = new URL(window.location.href);
          url.searchParams.delete("kakao_login");
          url.hash = "";
          window.history.replaceState({}, "", url.pathname + url.search);

          // 사용자 정보를 한 번만 조회해 이관·분기 양쪽에서 재사용한다
          type PlanUserData = {
            weddingDate?: string | null;
            budget?: number | string | null;
            name?: string | null;
            roomId?: number | null;
          };
          let planUser: PlanUserData | null = null;
          try {
            const userRes = await fetchWithAuth("/plan/user");
            const userJson = (await userRes.json()) as {
              result?: boolean;
              data?: PlanUserData;
            };
            if (userJson.result === true && userJson.data) {
              planUser = userJson.data;
            }
          } catch {
            // 조회 실패 시 planUser는 null로 두고 아래 분기에서 처리
          }

          fetchedRoomId = planUser?.roomId ?? null;
          const hasCompletePlan = !!planUser && isPlanDataComplete(planUser);

          if (planUser) {
            const { name, weddingDate, budget } = planUser;
            if (name) setName(name);
            if (budget) setBudget(String(budget));
            if (weddingDate) {
              const parts = weddingDate.split("-").map(Number);
              if (parts.length === 3 && !parts.some(Number.isNaN)) {
                setDate({ year: parts[0], month: parts[1], day: parts[2] });
              }
            }
          }

          /**
           * 게스트로 만든 데이터를 계정으로 옮긴다.
           *
           * 예전에는 이 처리가 `pathname === "/main"` 조건과 분기 우선순위
           * 뒤에 있어서, /add-plen 등에서 로그인하거나(→ returnPath 분기가
           * 먼저 잡힘) 이미 플랜이 있는 계정으로 로그인하면 게스트가 만든
           * 일정과 설정이 이관되지 않은 채 resetData()로 사라졌다.
           * 이제 경로·분기와 무관하게 항상 먼저 수행한다.
           *
           * @returns 이관 실패로 이동을 중단해야 하면 true
           */
          const migrateGuestData = async (): Promise<boolean> => {
            const guestPlans = getGuestScheduleList();
            // 설정 이관 조건:
            // 1. 게스트 온보딩을 실제로 마친 사용자여야 한다.
            //    WeddingContext가 날짜를 KST 오늘로 자동 채우므로, 플래그 없이
            //    weddingData.date만 보면 신규 사용자에게도 엉뚱한 플랜이 생긴다.
            // 2. 이미 플랜이 있는 계정의 예산·날짜·이름을 덮어쓰지 않는다.
            const hasCompletedGuestSetting =
              typeof window !== "undefined" &&
              sessionStorage.getItem(HAS_COMPLETED_GUEST_SETTING_KEY) === "1";
            const shouldMigrateSetting =
              !hasCompletePlan &&
              hasCompletedGuestSetting &&
              !!weddingData.date;

            if (!shouldMigrateSetting && guestPlans.length === 0) return false;

            if (shouldMigrateSetting && weddingData.date) {
              let nameToUse = weddingData.name?.trim() || "";
              if (!nameToUse) {
                nameToUse = await waitForName();
                setName(nameToUse);
                setLoading(true);
              }
              const { year, month, day } = weddingData.date;
              const weddingDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const guestAgreement = getGuestAgreement();
              // 실패하면 게스트 데이터를 지우지 않고 중단해 재시도 여지를 남긴다
              let settingSaved = false;
              try {
                const settingRes = await fetchWithAuth("/plan/setting", {
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
                settingSaved = settingRes.ok;
                if (settingSaved) clearGuestAgreement();
              } catch {
                settingSaved = false;
              }

              if (!settingSaved) {
                setAlertMessage(
                  "플랜 정보를 저장하지 못했습니다. 네트워크 확인 후 다시 시도해 주세요.",
                );
                return true;
              }
              migratedSetting = true;
            }

            if (guestPlans.length === 0) return false;

            // 전송이 모두 끝난 뒤에만 로컬 원본을 지운다
            const results = await Promise.all(
              guestPlans.map(async (item) => {
                const startDate = item.startDate?.trim() || getKstDateString();
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
                  const r = await fetchWithAuth("/plan/schedule", {
                    method: "POST",
                    body: JSON.stringify(body),
                  });
                  return r.ok;
                } catch {
                  return false;
                }
              }),
            );

            const failedCount = results.filter((ok) => !ok).length;
            if (failedCount === 0) {
              clearGuestScheduleList();
            } else {
              setAlertMessage(
                `플랜 ${failedCount}건을 옮기지 못했습니다. 잠시 후 다시 시도해 주세요.`,
              );
            }
            return false;
          };

          const migrationBlocked = await migrateGuestData();
          if (migrationBlocked) {
            router.replace("/main");
            return;
          }

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
              // useKakaoAuth 가 /share/CODE 를 returnPath 로도 저장해 두는데
              // 여기서 지우지 않으면 다음 로그인이 그 공유 페이지로 끌려간다.
              clearReturnPathAfterLogin();
              resetData();
              router.replace("/plan-list");
            }
            return;
          }

          // 저장된 돌아가기 경로 확인
          const returnPath = getReturnPathAfterLogin();
          if (returnPath) {
            clearReturnPathAfterLogin();
            resetData();
            router.replace(returnPath);
            return;
          }

          // 플랜이 이미 완성돼 있거나, 방금 게스트 설정을 이관해 완성된 경우 /main
          if (hasCompletePlan || migratedSetting) {
            if (pathname === "/main") {
              await onSuccessFromMain?.();
            }
            resetData();
            router.replace("/main");
            return;
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
    <>
      <NameInputModal show={showNameModal} onComplete={handleNameComplete} />
      <CustomAlertModal
        isOpen={alertMessage !== null}
        message={alertMessage ?? ""}
        type="error"
        onClose={() => setAlertMessage(null)}
      />
    </>
  );
}
