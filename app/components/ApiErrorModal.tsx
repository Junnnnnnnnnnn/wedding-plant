"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAllStoredData } from "@/lib/api";
import { useWedding } from "../contexts/WeddingContext";

const API_ERROR_MESSAGE =
  "데이터를 불러오는 중 오류가 발생했습니다. 처음부터 다시 시작해 주세요.";

export default function ApiErrorModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetData } = useWedding();
  const [isOpen, setIsOpen] = useState(false);

  const apiError = searchParams.get("api_error") === "1";

  useEffect(() => {
    if (apiError) {
      clearAllStoredData();
      resetData();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [apiError, resetData]);

  const handleClose = () => {
    setIsOpen(false);
    router.replace("/");
  };

  if (!isOpen) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={handleClose}
      onKeyDown={(e) => e.key === "Escape" && handleClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-modal="true"
        aria-label={API_ERROR_MESSAGE}
      >
        <p className="text-center text-lg font-semibold text-stone-900">
          {API_ERROR_MESSAGE}
        </p>
        <button
          type="button"
          onClick={handleClose}
          className="mt-4 w-full rounded-full bg-[#FFAAB8] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF9AA8]"
        >
          확인
        </button>
      </div>
    </div>
  );
}
