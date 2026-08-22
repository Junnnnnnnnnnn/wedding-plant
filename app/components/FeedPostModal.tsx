"use client";

import React, { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { useApi } from "../contexts/ApiContext";

export interface FeedPostTarget {
  scheduleId: number;
  categoryName: string;
  title: string;
  amount: number | null;
  location: string | null;
}

interface FeedPostModalProps {
  /** null 이면 닫힘 */
  target: FeedPostTarget | null;
  onClose: () => void;
  /** 올리기 성공. 부모가 목록을 다시 받는다 */
  onPosted?: () => void;
}

const ROLES = [
  { value: "BRIDE", label: "신부" },
  { value: "GROOM", label: "신랑" },
  { value: "UNKNOWN", label: "밝히지 않음" },
] as const;

/**
 * 후기 올리기.
 *
 * **글을 새로 쓰게 하지 않는다.** 카테고리·업체명·금액·지역은 이미 완료한
 * 일정에 다 있어서 서버가 그 값을 읽어 간다 — 사용자는 별점과 한 줄,
 * 공개 범위만 고른다. 콘텐츠 제작 비용이 낮아야 피드가 채워진다.
 *
 * 금액은 화면에 보여 주되 **여기서 고칠 수 없다.** 서버도 클라이언트가 보낸
 * 금액을 무시하고 일정 값을 쓴다 — 아무 숫자나 시세로 올릴 수 있으면 이
 * 피드의 유일한 값어치가 무너진다.
 */
const FeedPostModal: React.FC<FeedPostModalProps> = ({
  target,
  onClose,
  onPosted,
}) => {
  const { fetchWithAuth } = useApi();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [isAmountPublic, setIsAmountPublic] = useState(true);
  const [authorRole, setAuthorRole] =
    useState<(typeof ROLES)[number]["value"]>("BRIDE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 다른 일정으로 다시 열면 앞선 입력이 남아 있으면 안 된다
  useEffect(() => {
    if (!target) return;
    setRating(5);
    setBody("");
    setIsAmountPublic(true);
    setError(null);
  }, [target]);

  useEffect(() => {
    if (!target) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/plan/feed", {
        method: "POST",
        body: JSON.stringify({
          scheduleId: target.scheduleId,
          rating,
          body: body.trim() || undefined,
          isAmountPublic,
          authorRole,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        result?: boolean;
      } | null;
      if (!res.ok || json?.result !== true) {
        setError("올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      onPosted?.();
      onClose();
    } catch {
      setError("올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 px-4 py-6 md:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="후기 올리기"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold tracking-[-0.02em] text-[#1b0d14]">
              후기 올리기
            </h2>
            <p className="mt-1 text-[12.5px] text-[#7a6c74]">
              익명으로 올라가요. 이름은 보이지 않습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 올라갈 값. 여기서 고치지 못한다 */}
        <div className="rounded-2xl border border-[#f4eff2] bg-[#fcfbfc] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[14.5px] font-bold text-[#1b0d14]">
              {target.title}
            </span>
            <span className="font-user-content shrink-0 text-[16px] font-bold tracking-[-0.02em]">
              {target.amount === null
                ? "-"
                : `${target.amount.toLocaleString("ko-KR")}만원`}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-gray-400">
            {target.categoryName}
            {target.location ? " · 지역은 시/구까지만 올라가요" : ""}
          </p>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[12.5px] text-gray-400">만족도</p>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n}점`}
                aria-pressed={rating === n}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  className={`h-7 w-7 ${
                    n <= rating
                      ? "fill-[#ffb020] text-[#ffb020]"
                      : "text-[#e9e1e5]"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[12.5px] text-gray-400">
            한 줄 후기 <span className="text-gray-300">(선택)</span>
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="다음 사람이 알면 좋을 것 하나만 적어 주세요"
            className="w-full resize-none rounded-2xl border border-[#efe7eb] bg-white px-4 py-3 text-[14px] leading-relaxed text-[#1b0d14] outline-none transition-all placeholder:text-[#c8bfc4] focus:border-[#ee2b8c] focus:ring-4 focus:ring-[#ee2b8c14]"
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[12.5px] text-gray-400">나는</p>
          <div className="inline-flex gap-0.5 rounded-full bg-[#f4eff2] p-[3px]">
            {ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setAuthorRole(role.value)}
                aria-pressed={authorRole === role.value}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                  authorRole === role.value
                    ? "bg-white text-[#1b0d14] shadow-sm"
                    : "text-[#7a6c74] hover:text-[#1b0d14]"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#f4eff2] bg-[#fcfbfc] p-3.5">
          <input
            type="checkbox"
            checked={isAmountPublic}
            onChange={(e) => setIsAmountPublic(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#ee2b8c]"
          />
          <span className="text-[12.5px] leading-relaxed text-[#7a6c74]">
            <b className="font-bold text-[#1b0d14]">금액을 공개합니다.</b> 끄면
            업체와 후기만 올라가고 금액은 아무에게도 보이지 않습니다.
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-[#c0203c11] px-4 py-3 text-center text-[13px] font-bold text-[#c0203c]"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="mt-5 h-14 w-full rounded-2xl bg-[#ee2b8c] text-[15px] font-bold text-white transition-all hover:bg-[#d4237b] active:scale-[0.99] disabled:opacity-70"
        >
          {saving ? "올리는 중..." : "올리기"}
        </button>
      </div>
    </div>
  );
};

export default FeedPostModal;
