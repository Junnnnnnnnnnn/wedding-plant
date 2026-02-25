"use client";

import { useState } from "react";
import { X, MessageCircle, Plus } from "lucide-react";
import { useApi } from "@/app/contexts/ApiContext";

type ChatRoomCreateModalProps = {
  show: boolean;
  roomId: number | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function ChatRoomCreateModal({
  show,
  roomId,
  onClose,
  onCreated,
}: ChatRoomCreateModalProps) {
  const { fetchWithAuth } = useApi();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!show) return null;

  const isValid = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || saving || !roomId) return;
    setSaving(true);
    setError("");
    try {
      // Assuming /plan/room/{roomId}/chat is the creation endpoint for a chat room
      const res = await fetchWithAuth(`/plan/room/${roomId}/chat`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
        }),
      });
      if (res.ok) {
        onCreated();
        onClose();
        setName("");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          data.message || "채팅방 생성에 실패했습니다. 다시 시도해 주세요.",
        );
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] bg-white p-8 shadow-2xl transform transition-transform animate-slide-up"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-[#1b0d14]">
              새 채팅방 만들기
            </h2>
            <p className="text-gray-400 font-bold text-xs mt-1">
              우리만의 소중한 대화 채널을 추가해보세요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[#ee2b8c] uppercase tracking-widest pl-1">
              채팅방 이름
            </label>
            <div className="relative">
              <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="예: 스튜디오 촬영 준비, 혼수 가전..."
                className="w-full rounded-2xl border-2 border-stone-50 bg-[#fcfbfc] pl-12 pr-4 py-4 text-lg font-bold text-stone-900 focus:border-[#ee2b8c] focus:outline-none transition-all placeholder:text-stone-200"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <p className="text-center text-xs text-red-500 font-bold bg-red-50 py-3 rounded-xl animate-shake">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="w-full rounded-2xl bg-[#ee2b8c] py-5 text-lg font-black text-white shadow-xl shadow-[#ee2b8c33] transition-all hover:bg-[#d41c75] active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>생성 중...</span>
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                <span>채팅방 생성하기</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
