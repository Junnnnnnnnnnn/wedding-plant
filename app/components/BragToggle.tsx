"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Globe, Heart, RefreshCw } from "lucide-react";
import { getToken } from "@/lib/api";
import { BragMyStatus } from "@/types";
import { useApi } from "../contexts/ApiContext";

/**
 * 홈 예산 패널 안의 **자랑하기 토글** (시안 `docs/concepts/brag-a.html` 1단계).
 *
 * 켜면 내 플랜 한 장이 `/brag` 목록에 올라간다. 끄면 내려간다.
 *
 * **켜기 전에 반드시 안내 모달을 거친다.** 이 앱의 다른 화면(피드)은 철저히
 * 익명인데 자랑하기는 **닉네임이 그대로 공개**된다 — 두 화면의 규칙이 정반대라,
 * 무엇이 공개되는지 글자 그대로 보여 주지 않으면 사람이 착각한 채로 켠다.
 * 끄는 것은 되돌릴 수 있으므로 확인을 받지 않는다.
 *
 * **켜 두는 동안 지금 플랜이 그대로 보인다(라이브).** 처음에는 올리는 순간의
 * 스냅샷으로 만들고 "올린 뒤에는 고칠 수 없어요" 라고 적었는데, 그러면 켠 뒤에
 * 일정을 고치거나 장소를 붙여도 자랑하기가 얼어붙은 채로 남는다. 고치려면
 * 토글을 껐다 켜야 한다는 것을 사람이 알 방법이 없었다 — 원래 규칙인
 * "수정하지 못하고 볼 수만 있다" 는 **보는 사람** 이야기다.
 */

/**
 * 공개되는 것. **"일부 정보" 같은 말을 쓰지 않는다** — 글자 그대로 적는다.
 *
 * 이 목록이 백엔드 응답(`BragDetail`)의 상한이다. 넓혀야 하면 **여기를 먼저
 * 고치고** 응답을 고친다. 순서를 뒤집으면 동의받지 않은 것을 공개하게 된다.
 * 계약은 `docs/BRAG_API.md`.
 */
const OPEN_FIELDS =
  "닉네임 · 결혼식 날짜 · 총예산 · 카테고리별 지출과 소계 · 일정 제목 · 일정별 금액과 결제 여부 · 일정 장소";

const RULES: Array<{ icon: typeof Globe; title: string; body: string }> = [
  {
    icon: Globe,
    title: "자랑하기 목록에 올라가요",
    body: "로그인한 누구나 우리 플랜 한 장을 볼 수 있어요.",
  },
  {
    icon: RefreshCw,
    title: "플랜을 고치면 같이 바뀌어요",
    body: "올린 순간이 아니라 지금 플랜이 보입니다. 일정을 더하거나 장소를 붙이면 그대로 따라와요.",
  },
  {
    icon: Heart,
    title: "다른 사람은 보기와 좋아요만",
    body: "댓글은 없어요. 우리 플랜을 남이 바꾸는 일도 없습니다.",
  },
];

interface BragToggleProps {
  /** 폰의 예산 카드에 들어갈 때. 여백과 글자를 한 단계 줄인다 */
  compact?: boolean;
}

/**
 * 상태를 **모듈 한 곳에** 둔다.
 *
 * `/main` 은 폰 트리(`md:hidden`)와 대시보드(`hidden md:block`)를 **둘 다
 * 렌더**한다 — 같은 DOM 을 CSS 로 재배치할 수 없어서다. 그래서 이 컴포넌트도
 * 두 번 붙는데, 각자 `/plan/brag/my` 를 부르면 **매 진입마다 같은 요청이 두
 * 번** 나가고 켠 뒤 상태가 한쪽에만 반영된다. 여기 모아 두면 요청은 한 번,
 * 상태는 하나다.
 *
 * (`SoloPlanBanner` 도 두 번 렌더되지만 그쪽은 부모가 값을 내려 줘서 이
 * 문제가 없다. 이 토글은 자기 데이터를 스스로 받으므로 여기서 막는다.)
 */
const store: {
  status: BragMyStatus | null;
  loading: Promise<void> | null;
  subs: Set<(s: BragMyStatus | null) => void>;
} = { status: null, loading: null, subs: new Set() };

function publishStatus(next: BragMyStatus | null) {
  store.status = next;
  store.subs.forEach((fn) => fn(next));
}

export default function BragToggle({ compact = false }: BragToggleProps) {
  const router = useRouter();
  const { fetchWithAuth } = useApi();

  const [status, setStatus] = useState<BragMyStatus | null>(store.status);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState(false);
  /**
   * 게스트에게는 이 자리를 아예 내지 않는다 — 서버에 올릴 플랜이 없어서
   * 켜도 아무 일이 안 일어난다. **effect 안에서** 읽는 이유는 `getToken()`
   * 이 클라이언트 전용이라 서버 렌더와 값이 어긋나기 때문이다
   * (온보딩의 `canInvite` 와 같은 처리).
   */
  const [signedIn, setSignedIn] = useState(false);

  const load = useCallback(async () => {
    // 두 인스턴스가 동시에 뜨므로 이미 나간 요청이 있으면 그걸 기다린다
    if (store.loading) return store.loading;
    store.loading = (async () => {
      try {
        const res = await fetchWithAuth("/plan/brag/my", { skipLoading: true });
        const json = (await res.json()) as {
          result?: boolean;
          data?: BragMyStatus;
        };
        if (json.result === true && json.data) publishStatus(json.data);
      } catch {
        // 못 받아도 화면은 "안 올림" 으로 그린다. 켤 때 서버가 다시 판단한다
      } finally {
        store.loading = null;
      }
    })();
    return store.loading;
  }, [fetchWithAuth]);

  useEffect(() => {
    store.subs.add(setStatus);
    return () => {
      store.subs.delete(setStatus);
    };
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    setSignedIn(true);
    if (store.status === null) load();
  }, [load]);

  const publish = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetchWithAuth("/plan/brag", { method: "PUT" });
      const json = (await res.json()) as {
        result?: boolean;
        data?: { bragId?: number };
      };
      if (json.result !== true) return;
      setSheetOpen(false);
      publishStatus({
        published: true,
        bragId: json.data?.bragId ?? null,
        publishedAt: new Date().toISOString(),
        likeCount: 0,
      });
    } catch {
      // 실패하면 시트가 열린 채로 남는다 — 켜졌다고 잘못 보이지 않게
    } finally {
      setPending(false);
    }
  };

  const unpublish = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetchWithAuth("/plan/brag", { method: "DELETE" });
      const json = (await res.json()) as { result?: boolean };
      if (json.result !== true) return;
      publishStatus({
        published: false,
        bragId: null,
        publishedAt: null,
        likeCount: 0,
      });
    } catch {
      // 그대로 켜진 채로 둔다
    } finally {
      setPending(false);
    }
  };

  const on = status?.published === true;

  if (!signedIn) return null;

  return (
    <>
      <div
        className={
          compact
            ? "mt-4 border-t border-dashed border-[#f2eaee] pt-4"
            : "mt-5 border-t border-dashed border-[#f2eaee] pt-[18px]"
        }
      >
        <button
          type="button"
          data-brag-toggle
          role="switch"
          aria-checked={on}
          disabled={pending}
          onClick={() => (on ? unpublish() : setSheetOpen(true))}
          className="flex w-full items-center gap-3 rounded-[14px] bg-[#faf7f9] px-4 py-3 text-left transition-colors hover:bg-[#f4eff2] disabled:opacity-60"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold text-[#1b0d14]">
              자랑하기
            </span>
            <span className="mt-0.5 block text-[12px] text-[#7a6c74]">
              {on
                ? "우리 플랜이 자랑하기에 올라가 있어요"
                : "우리 플랜을 자랑하기에 올려요"}
            </span>
          </span>
          {/* 스위치. 껐다 켜는 것이지 "제출"이 아니라는 걸 모양으로 말한다 */}
          <span
            aria-hidden
            className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors ${
              on ? "bg-[#ee2b8c]" : "bg-stone-300"
            }`}
          >
            <i
              className={`absolute left-[3px] top-[3px] block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                on ? "translate-x-[18px]" : ""
              }`}
            />
          </span>
        </button>

        {on && (
          <div className="mt-2 flex items-center gap-2 rounded-[14px] bg-[#fff2f6] px-4 py-2.5 text-[12px] text-[#ee2b8c]">
            <Heart
              className="h-3.5 w-3.5 shrink-0"
              fill="currentColor"
              strokeWidth={0}
            />
            좋아요{" "}
            <b className="font-bold tabular-nums">
              {(status?.likeCount ?? 0).toLocaleString("ko-KR")}
            </b>
            {/*
              폰에서 자랑하기로 들어가는 **유일한 문**이다. 레일이 없는 폭에서는
              여기 말고 목록으로 갈 방법이 없다 — 지우지 말 것.
            */}
            <button
              type="button"
              onClick={() => router.push("/brag")}
              className="ml-auto inline-flex items-center gap-0.5 font-bold transition-opacity hover:opacity-70"
            >
              보러 가기
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-[200] grid place-items-center bg-[#1a1c20]/35 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="자랑하기 안내"
            className="max-h-[86dvh] w-full max-w-[340px] overflow-y-auto rounded-[24px] bg-white px-5 pb-5 pt-6 shadow-2xl"
          >
            <h2 className="text-[20px] font-bold leading-snug tracking-[-0.03em] text-[#1b0d14]">
              자랑하기에 올릴까요?
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#7a6c74]">
              우리 플랜 한 장이 그대로 올라갑니다. 언제든 다시 내릴 수 있어요.
            </p>

            {/* 번호를 붙이지 않는다 — 순서가 아니라 성질이다 */}
            <div className="mt-5 grid gap-3.5">
              {RULES.map((rule) => {
                const Icon = rule.icon;
                return (
                  <div key={rule.title} className="flex items-start gap-3">
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-[#fff2f6] text-[#ee2b8c]">
                      <Icon className="h-[15px] w-[15px]" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-bold leading-snug text-[#1b0d14]">
                        {rule.title}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-[#7a6c74]">
                        {rule.body}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-[14px] bg-[#f7f5f6] px-4 py-3.5">
              <span className="block text-[12px] font-bold text-gray-400">
                공개되는 것
              </span>
              <span className="mt-1 block text-[13px] leading-relaxed text-[#1b0d14]">
                {OPEN_FIELDS}
              </span>
            </div>

            <div className="mt-6 grid gap-2">
              <button
                type="button"
                onClick={publish}
                disabled={pending}
                className="rounded-2xl bg-[#ee2b8c] py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#d81f7c] disabled:opacity-60"
              >
                {pending ? "올리는 중" : "자랑하기에 올리기"}
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-2xl py-3 text-[14px] font-bold text-[#7a6c74] transition-colors hover:bg-stone-50"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
