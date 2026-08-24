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

import { track } from "@/lib/analytics";

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
  /**
   * 이관 실패 안내를 닫은 뒤에 실행할 이동.
   *
   * 예전에는 setAlertMessage 직후 곧바로 router.replace 를 불렀다.
   * 이 컴포넌트는 로그인 착지 페이지에만 마운트돼 있어서, 이동과 동시에
   * 언마운트되며 안내가 화면에 뜨지도 못하고 사라졌다. 게스트가 만든
   * 플랜이 옮겨지지 않았는데 사용자는 아무것도 듣지 못했다.
   */
  const pendingNavRef = useRef<(() => void) | null>(null);
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
      /** 이관 도중 사용자에게 알려야 할 문구 (있으면 이동 전에 먼저 보여준다) */
      let pendingMessage: string | null = null;
      /** 안내가 밀려 있으면 사용자가 확인을 누른 뒤에 이동한다 */
      const go = (navigate: () => void) => {
        if (!pendingMessage) {
          navigate();
          return;
        }
        pendingNavRef.current = navigate;
        setAlertMessage(pendingMessage);
        setLoading(false);
      };
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
          track("signup");
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
                pendingMessage =
                  "플랜 정보를 저장하지 못했습니다. 네트워크 확인 후 다시 시도해 주세요.";
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
              pendingMessage = `플랜 ${failedCount}건을 옮기지 못했습니다. 잠시 후 다시 시도해 주세요.`;
            }
            return false;
          };

          /**
           * 게스트로 동의한 약관을 계정에 반영한다.
           *
           * 예전에는 이 동기화가 설정 이관(shouldMigrateSetting) 안에만
           * 있었다. 그래서 이미 플랜이 있는 계정으로 로그인하면 게스트
           * 동의가 백엔드에 올라가지 않고 sessionStorage 에 남아, 다음에
           * 다시 약관 동의를 요구받았다. 이관 여부와 무관하게 남아 있으면
           * 한 번 더 시도한다.
           */
          const syncLeftoverAgreement = async () => {
            const leftover = getGuestAgreement();
            if (!leftover || !planUser) return;
            const { weddingDate, budget, name } = planUser;
            // /plan/setting 은 이 셋을 함께 요구한다. 없으면 보낼 수 없다.
            if (!weddingDate || !name?.trim()) return;
            try {
              const agreementRes = await fetchWithAuth("/plan/setting", {
                method: "POST",
                body: JSON.stringify({
                  weddingDate,
                  budget: Number(budget) || 0,
                  name: name.trim(),
                  requiredAgreementDate: leftover.requiredAgreementDate,
                  ...(leftover.adAgreementDate && {
                    adAgreementDate: leftover.adAgreementDate,
                  }),
                }),
              });
              if (agreementRes.ok) clearGuestAgreement();
            } catch {
              // 실패해도 로그인 흐름은 계속한다. 값은 남겨 다음에 재시도.
            }
          };

          const migrationBlocked = await migrateGuestData();
          if (migrationBlocked) {
            go(() => router.replace("/main"));
            return;
          }
          await syncLeftoverAgreement();

          /**
           * 로그인 후 착지 지점을 정한다.
           *
           * 우선순위: 공유 링크 > 복귀 경로 > 완성된 플랜 > 참여 중인 방 >
           * 신규 사용자. 각 분기가 흩어져 있으면 앞 분기에서 return 을
           * 빠뜨렸을 때 뒤 분기가 잘못 실행되므로, 목적지를 값으로 돌려
           * 이동은 아래 한 곳에서만 하도록 모았다.
           *
           * hard: true 는 SPA 라우팅이 아니라 문서 전체를 새로 여는 이동.
           */
          const resolveDestination = async (): Promise<{
            path: string;
            hard?: boolean;
          }> => {
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
              }
              return { path: "/plan-list" };
            }

            const returnPath = getReturnPathAfterLogin();
            if (returnPath) {
              clearReturnPathAfterLogin();
              return { path: returnPath };
            }

            // 플랜이 이미 완성돼 있거나, 방금 게스트 설정을 이관해 완성된 경우
            if (hasCompletePlan || migratedSetting) {
              if (pathname === "/main") {
                await onSuccessFromMain?.();
              }
              return { path: "/main" };
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
                return { path: "/plan-list" };
              }
            } catch (err) {
              console.error(
                "Failed to fetch room list during login redirect:",
                err,
              );
            }

            // 개인 플랜도 없고 참여 중인 방도 없으면 온보딩으로
            return { path: "/setting", hard: true };
          };

          const destination = await resolveDestination();
          resetData();
          go(() => {
            if (destination.hard) {
              window.location.href = destination.path;
              return;
            }
            router.replace(destination.path);
          });
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
        onClose={() => {
          setAlertMessage(null);
          const navigate = pendingNavRef.current;
          pendingNavRef.current = null;
          navigate?.();
        }}
      />
    </>
  );
}
