"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/app/contexts/ApiContext";
import { track } from "@/lib/analytics";

/**
 * 초대 링크 조회 + 역할별 공유.
 *
 * 초대 링크가 역할을 지닌다 — `?as=spouse` 로 들어오면 바로 `SPOUSE`,
 * 그냥 들어오면 `READ` 다. 그래서 "공유하기" 하나로는 상대가 어떤 권한으로
 * 들어올지 알 수 없고, 부르는 쪽에서 역할을 정해야 한다.
 *
 * 온보딩의 초대 단계와 홈의 초대 띠가 같은 동작을 해야 해서 여기로 뺐다.
 * (`components/SharePlanModal.tsx` 에도 같은 흐름이 있다. 모달은 에러 문구가
 *  화면 상태와 얽혀 있어 아직 옮기지 않았다 — 고칠 때 이 훅으로 모으세요.)
 */

export type InviteRole = "spouse" | "viewer";

type InviteResult = "shared" | "copied" | "cancelled" | "failed";

interface UseSpouseInviteOptions {
  /** true 일 때만 링크를 받아 온다. 화면에 뜨기 전에는 부르지 않는다 */
  enabled?: boolean;
  /** GA 이벤트에 남길 진입 지점 (`onboarding` · `home_banner` 등) */
  from: string;
}

export function useSpouseInvite({
  enabled = true,
  from,
}: UseSpouseInviteOptions) {
  const { fetchWithAuth } = useApi();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetchWithAuth("/plan/room/share-code", {
          method: "GET",
          skipLoading: true,
        });
        if (cancelled) return;
        if (!res.ok) throw new Error("링크를 불러오지 못했습니다.");

        const json = (await res.json()) as {
          result?: boolean;
          data?: { shareCode?: string };
        };
        const code = json?.data?.shareCode;
        if (!code) throw new Error("링크를 불러오지 못했습니다.");
        if (cancelled) return;
        setShareUrl(`${window.location.origin}/share/${code}`);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "링크를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchWithAuth]);

  /**
   * 공유 시트가 있으면 시트로, 없으면 클립보드로. 시트를 취소하면
   * `AbortError` 가 나는데, 이건 실패가 아니라 "안 보냄"이라 지표에서 뺀다.
   */
  const invite = useCallback(
    async (role: InviteRole = "spouse"): Promise<InviteResult> => {
      if (!shareUrl) {
        setError(loading ? "준비 중입니다." : "링크를 불러오지 못했습니다.");
        return "failed";
      }
      setError(null);

      const url = role === "spouse" ? `${shareUrl}?as=spouse` : shareUrl;
      const shareData = {
        title: "웨딩 플랜 공유",
        text:
          role === "spouse"
            ? "우리 결혼 준비, 같이 하자!"
            : "우리 결혼 준비 같이 봐줘!",
        url,
      };

      if (navigator.share && navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
          track("invite_send", { role, from });
          return "shared";
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            return "cancelled";
          }
          setError("공유에 실패했습니다.");
          return "failed";
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        track("invite_send", { role, from });
        return "copied";
      } catch {
        setError("이 브라우저에서는 공유 기능을 지원하지 않습니다.");
        return "failed";
      }
    },
    [shareUrl, loading, from],
  );

  return { shareUrl, loading, error, setError, invite } as const;
}

export default useSpouseInvite;
