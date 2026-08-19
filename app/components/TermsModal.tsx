"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type TermsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: React.ReactNode;
};

export default function TermsModal({
  isOpen,
  onClose,
  title,
  content,
}: TermsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * 닫혀 있을 때는 body 스타일을 건드리지 않는다.
   *
   * 예전에는 isOpen 이 false 여도 overflow 를 "unset" 으로 되돌렸다.
   * /setting 은 네 개의 TermsModal 을 한꺼번에 마운트해 두는데, 그
   * 마운트만으로 페이지가 걸어 둔 스크롤 락이 즉시 풀렸다.
   * 열 때 직전 값을 기억했다가 닫을 때 그대로 되돌린다.
   */
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed z-[9999] flex items-center justify-center bg-black/50 px-4 animate-fade-in"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        height: "100dvh",
        width: "100vw",
      }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl flex flex-col max-h-[80vh] h-auto my-auto"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-center text-lg font-semibold text-stone-900 border-b border-stone-100 pb-4 shrink-0">
          {title}
        </h2>

        <div className="mt-4 overflow-y-auto pr-2 text-sm text-stone-600 leading-relaxed text-left font-user-content whitespace-pre-wrap">
          {content}
        </div>

        <div className="mt-6 shrink-0 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full h-12 flex items-center justify-center text-[15px] font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99] text-white"
            style={{ backgroundColor: "#FFAAB8" }}
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
