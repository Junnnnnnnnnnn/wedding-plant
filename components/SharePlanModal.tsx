"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Share2,
  MessageCircle,
  CalendarRange,
  Sprout,
  Heart,
} from "lucide-react";
import { useApi } from "@/app/contexts/ApiContext";

import { track } from "@/lib/analytics";

interface SharePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** GET /plan/user 의 members 항목 */
interface RoomMember {
  planUserId: string;
  name: string;
  image: string | null;
  permission: string;
}

const SharePlanModal: React.FC<SharePlanModalProps> = ({ isOpen, onClose }) => {
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareUrlLoading, setShareUrlLoading] = useState(false);
  const { fetchWithAuth } = useApi();
  /**
   * 멤버 목록과 배우자 지정. 초대하고 · 누가 들어왔는지 보고 · 신랑·신부를
   * 정하는 일이 한 흐름이라 공유 모달에 같이 둔다.
   */
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [spouseSaving, setSpouseSaving] = useState<string | null>(null);
  /** 배우자가 이미 있으면 배우자 초대 버튼을 막는다 — 한 명뿐이다 */
  const hasSpouse = members.some(
    (m) => m.permission?.toUpperCase() === "SPOUSE",
  );

  const loadMembers = React.useCallback(async () => {
    try {
      const res = await fetchWithAuth("/plan/user", { skipLoading: true });
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
        data?: { id?: string; members?: RoomMember[] };
      } | null;
      if (json?.result !== true || !json.data) return;

      const list = json.data.members ?? [];
      setMembers(list);
      // 방장만 배우자를 정할 수 있다
      setIsOwner(
        list.some(
          (m) =>
            m.planUserId === json.data?.id &&
            m.permission?.toUpperCase() === "OWNER",
        ),
      );
    } catch {
      // 공유 모달의 부가 정보라 실패해도 링크 공유는 그대로 쓸 수 있다
    }
  }, [fetchWithAuth]);

  const setSpouse = async (planUserId: string | null) => {
    setSpouseSaving(planUserId ?? "clear");
    try {
      await fetchWithAuth("/plan/room/spouse", {
        method: "PATCH",
        body: JSON.stringify({ planUserId }),
        skipLoading: true,
      });
      await loadMembers();
    } catch {
      setShareError("변경에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSpouseSaving(null);
    }
  };

  // 모달이 열릴 때 미리 share code 조회
  useEffect(() => {
    if (!isOpen) {
      setShareUrl(null);
      setShareError(null);
      return;
    }
    let cancelled = false;
    setShareUrlLoading(true);
    setShareError(null);
    loadMembers();
    (async () => {
      try {
        const res = await fetchWithAuth("/plan/room/share-code", {
          method: "GET",
        });
        if (cancelled) return;
        if (!res.ok) {
          throw new Error("공유 링크 생성에 실패했습니다.");
        }
        const json = (await res.json()) as {
          result?: boolean;
          data?: { shareCode?: string };
        };
        const code = json?.data?.shareCode;
        if (!code) {
          throw new Error("shareCode를 받지 못했습니다.");
        }
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}/share/${code}`
            : "";
        setShareUrl(url);
      } catch (err) {
        if (!cancelled) {
          setShareError(
            err instanceof Error ? err.message : "링크를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setShareUrlLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, fetchWithAuth, loadMembers]);

  /**
   * 역할별 초대. 링크에 `?as=spouse` 를 붙이면 받은 사람이 바로 신랑·신부가
   * 된다 — 이미 배우자가 있으면 서버가 조용히 "함께 보는 사람"으로 넣는다.
   */
  const handleShare = async (role: "spouse" | "viewer" = "viewer") => {
    setShareError(null);
    if (!shareUrl) {
      setShareError(
        shareUrlLoading ? "준비 중입니다." : "링크를 불러오지 못했습니다.",
      );
      return;
    }

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
        // 공유 시트를 취소하면 AbortError 로 빠져 여기까지 오지 않는다 —
        // 실제로 보낸 것만 센다.
        track("invite_send", { role });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setShareError("공유에 실패했습니다.");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        track("invite_send", { role });
        setShareError("링크가 클립보드에 복사되었습니다.");
      } catch {
        setShareError("이 브라우저에서는 공유 기능을 지원하지 않습니다.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-t-[44px] px-5 sm:px-6 pt-8 pb-10 sm:p-10 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom duration-300 overflow-hidden relative flex flex-col max-h-[calc(100dvh-120px)] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#ee2b8c] to-[#ff94a1]" />

        <header className="flex justify-between items-center mb-6 sm:mb-8 flex-shrink-0">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1b0d14] tracking-tight">
              플랜 공유하기
            </h3>
            <p className="text-gray-400 text-[10px] sm:text-xs font-bold mt-0.5 sm:mt-1">
              함께 관리할 사람들을 초대하세요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </header>

        <div className="space-y-6 sm:space-y-8 overflow-y-auto flex-1 min-h-0 scrollbar-hide -mx-2 px-2 pb-2">
          {/* Info Badge */}
          <div className="flex justify-center">
            <div className="px-4 py-1.5 bg-[#ee2b8c08] rounded-full border border-[#ee2b8c11]">
              <p className="text-[#ee2b8c] text-[10px] sm:text-[11px] font-bold tracking-wide">
                현재 최대 1명까지 공유 가능 · 추후 확대 예정
              </p>
            </div>
          </div>

          {/* Benefits List */}
          <div className="space-y-4 sm:space-y-5">
            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[#ee2b8c03] border border-gray-50 transition-all hover:bg-[#ee2b8c08] hover:border-[#ee2b8c15] hover:translate-x-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ee2b8c] to-[#ff6b9d] flex items-center justify-center text-white shadow-lg shadow-[#ee2b8c22] transition-transform group-hover:scale-110">
                <MessageCircle className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[#1b0d14] text-base leading-none">
                  실시간 소통
                </h4>
                <p className="text-gray-400 text-[11px] sm:text-xs mt-1.5 font-bold leading-relaxed break-keep">
                  실시간 채팅과 알림으로 파트너와 즉각적으로 소통하며 준비해요.
                </p>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[#ee2b8c03] border border-gray-50 transition-all hover:bg-[#ee2b8c08] hover:border-[#ee2b8c15] hover:translate-x-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#818cf8] flex items-center justify-center text-white shadow-lg shadow-[#6366f122] transition-transform group-hover:scale-110">
                <CalendarRange className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[#1b0d14] text-base leading-none">
                  일정 공유
                </h4>
                <p className="text-gray-400 text-[11px] sm:text-xs mt-1.5 font-bold leading-relaxed break-keep">
                  복잡한 웨딩 스케줄을 하나의 캘린더로 함께 보고 꼼꼼하게
                  관리하세요.
                </p>
              </div>
            </div>

            <div className="group flex items-center gap-4 p-4 rounded-2xl bg-[#ee2b8c03] border border-gray-50 transition-all hover:bg-[#ee2b8c08] hover:border-[#ee2b8c15] hover:translate-x-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#059669] to-[#10b981] flex items-center justify-center text-white shadow-lg shadow-[#05966922] transition-transform group-hover:scale-110">
                <Sprout className="w-6 h-6" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-[#1b0d14] text-base leading-none">
                  함께 키우는 재미
                </h4>
                <p className="text-gray-400 text-[11px] sm:text-xs mt-1.5 font-bold leading-relaxed break-keep">
                  준비 단계에 따라 성장하는 우리만의 웨딩 플랜트을 함께
                  완성해보세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 참여 멤버 + 신랑·신부 지정 */}
        {members.length > 0 && (
          <div className="mt-6 flex-shrink-0 rounded-2xl border border-gray-50 bg-[#fcfbfc] p-4">
            <h4 className="mb-3 text-[13px] font-black text-[#1b0d14]">
              참여 멤버
            </h4>
            <div className="space-y-2">
              {members.map((m) => {
                const perm = m.permission?.toUpperCase();
                const isSpouse = perm === "SPOUSE";
                const isRoomOwner = perm === "OWNER";
                return (
                  <div
                    key={m.planUserId}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ee2b8c11] text-[12px] font-black text-[#ee2b8c]">
                      {m.image ? (
                        <img
                          src={m.image}
                          alt={m.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (m.name?.trim().charAt(0) ?? "?")
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#1b0d14]">
                      {m.name}
                    </span>
                    {isRoomOwner ? (
                      <span className="shrink-0 text-[11.5px] text-gray-400">
                        방장
                      </span>
                    ) : isSpouse ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff2f6] px-2 py-1 text-[11px] font-bold text-[#ee2b8c]">
                        <Heart className="h-2.5 w-2.5 fill-current" />
                        신랑 · 신부
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11.5px] text-gray-400">
                        함께 보는 중
                      </span>
                    )}
                    {isOwner && !isRoomOwner && (
                      <button
                        type="button"
                        disabled={spouseSaving !== null}
                        onClick={() =>
                          setSpouse(isSpouse ? null : m.planUserId)
                        }
                        className="shrink-0 rounded-lg border border-[#f0e3ea] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#6b6570] transition-colors hover:border-[#ee2b8c55] hover:text-[#ee2b8c] disabled:opacity-50"
                      >
                        {isSpouse ? "해제" : "배우자로"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {isOwner && (
              <p className="mt-3 text-[11.5px] leading-relaxed text-gray-400 break-keep">
                신랑·신부는 한 명만 정할 수 있어요. 함께 일정과 예산을 고칠 수
                있고, 함께 보는 사람은 대화만 할 수 있어요.
              </p>
            )}
          </div>
        )}

        {/* Share Button at the bottom */}
        <div className="mt-6 sm:mt-8 space-y-3 flex-shrink-0">
          {shareError && (
            <div
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-center ${shareError.includes("복사") ? "bg-green-50" : "bg-red-50"}`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${shareError.includes("복사") ? "bg-green-500" : "bg-red-500"}`}
              />
              <p
                className={`text-[11px] sm:text-xs font-bold ${shareError.includes("복사") ? "text-green-600" : "text-red-500"}`}
              >
                {shareError}
              </p>
            </div>
          )}
          {/*
            역할별 초대. 링크가 역할을 지니므로 누구를 부르는지 버튼에서
            정한다. 하나의 "공유하기" 로는 상대가 어떤 권한으로 들어올지
            알 수 없었다.
          */}
          <button
            type="button"
            onClick={() => handleShare("spouse")}
            disabled={shareUrlLoading || hasSpouse}
            className="w-full h-14 sm:h-16 bg-gradient-to-r from-[#ee2b8c] to-[#ff6b9d] text-white rounded-2xl sm:rounded-3xl flex items-center justify-center gap-3 font-black text-base sm:text-lg shadow-xl shadow-[#ee2b8c33] hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-60 disabled:pointer-events-none"
          >
            <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
            <span>
              {shareUrlLoading
                ? "준비 중..."
                : hasSpouse
                  ? "신랑 · 신부는 이미 있어요"
                  : "신랑 · 신부 초대하기"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleShare("viewer")}
            disabled={shareUrlLoading}
            className="w-full h-13 sm:h-14 rounded-2xl sm:rounded-3xl border border-[#f0e3ea] bg-white text-[#6b6570] flex items-center justify-center gap-2.5 font-bold text-sm sm:text-base transition-colors hover:border-[#ee2b8c55] hover:text-[#ee2b8c] disabled:opacity-60 disabled:pointer-events-none"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
            <span>함께 볼 사람 초대하기</span>
          </button>
          <p className="text-center text-[11.5px] leading-relaxed text-gray-400 break-keep">
            신랑·신부는 일정과 예산을 같이 고칠 수 있어요. 함께 보는 사람은
            대화만 할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharePlanModal;
