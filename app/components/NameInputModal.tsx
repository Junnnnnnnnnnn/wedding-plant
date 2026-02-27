"use client";

import { useState } from "react";
import { useApi } from "@/app/contexts/ApiContext";
import PrivacyAgreementSection, {
  initialAgreementState,
  isAllRequiredAgreed,
  type AgreementState,
} from "./PrivacyAgreementSection";
import { getKstDateString } from "@/lib/utils";

type NameInputModalProps = {
  show: boolean;
  onComplete: (name: string) => void;
};

export default function NameInputModal({
  show,
  onComplete,
}: NameInputModalProps) {
  const { fetchWithAuth } = useApi();
  const [name, setName] = useState("");
  const [agreement, setAgreement] = useState<AgreementState>(
    initialAgreementState,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!show) return null;

  const trimmed = name.trim();
  const nameValid = trimmed.length > 0 && trimmed.length <= 6;
  const agreementValid = isAllRequiredAgreed(agreement);
  const isValid = nameValid && agreementValid;

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    setError("");
    const agreementDate = getKstDateString();
    try {
      const res = await fetchWithAuth("/plan/setting", {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          requiredAgreementDate: agreementDate,
          ...(agreement.agreeMarketing && { adAgreementDate: agreementDate }),
        }),
      });
      if (res.ok) {
        onComplete(trimmed);
      } else {
        setError("저장에 실패했습니다. 다시 시도해 주세요.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 overflow-y-auto py-6"
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white px-5 py-6 sm:p-6 shadow-xl my-auto"
        role="dialog"
        aria-modal="true"
        aria-label="이름 입력"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") handleSubmit();
        }}
        tabIndex={-1}
      >
        <h2 className="text-center text-lg font-bold text-stone-900">
          이름을 입력해 주세요
        </h2>
        <p className="mt-2 text-center text-sm text-stone-500">
          다른 멤버에게 보여지는 이름이에요 (최대 6글자)
        </p>

        <div className="mt-5">
          <input
            type="text"
            maxLength={6}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder="예: 진주"
            className="w-full rounded-xl border-2 border-stone-200 px-4 py-3 text-center text-lg font-tmoney-extra-bold text-stone-900 placeholder:text-stone-300 focus:border-[#ee2b8c] focus:outline-none transition-colors"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-center text-xs text-red-500 font-medium">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5">
          <PrivacyAgreementSection
            agreement={agreement}
            onAgreementChange={setAgreement}
            compact
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="mt-4 w-full rounded-xl bg-[#ee2b8c] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d4237b] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "저장 중..." : "확인"}
        </button>
      </div>
    </div>
  );
}
