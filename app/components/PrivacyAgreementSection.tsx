"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import TermsModal from "./TermsModal";
import {
  PRIVACY_CONTENT,
  LOCATION_CONTENT,
  THIRD_PARTY_CONTENT,
  MARKETING_CONTENT,
} from "@/lib/legal";

export interface AgreementState {
  agreePrivacy: boolean;
  agreeLocation: boolean;
  agreeThirdParty: boolean;
  agreeMarketing: boolean;
}

export const initialAgreementState: AgreementState = {
  agreePrivacy: false,
  agreeLocation: false,
  agreeThirdParty: false,
  agreeMarketing: false,
};

export function isAllRequiredAgreed(state: AgreementState): boolean {
  return state.agreePrivacy && state.agreeLocation && state.agreeThirdParty;
}

export function isAllAgreed(state: AgreementState): boolean {
  return isAllRequiredAgreed(state) && state.agreeMarketing;
}

type PrivacyAgreementSectionProps = {
  agreement: AgreementState;
  onAgreementChange: (agreement: AgreementState) => void;
  /** 모달용 컴팩트 스타일 (max-w 제한) */
  compact?: boolean;
};

export default function PrivacyAgreementSection({
  agreement,
  onAgreementChange,
  compact = false,
}: PrivacyAgreementSectionProps) {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showThirdPartyModal, setShowThirdPartyModal] = useState(false);
  const [showMarketingModal, setShowMarketingModal] = useState(false);

  const allAgreed = isAllAgreed(agreement);

  const handleAgreeAll = () => {
    const next = !allAgreed;
    onAgreementChange({
      agreePrivacy: next,
      agreeLocation: next,
      agreeThirdParty: next,
      agreeMarketing: next,
    });
  };

  const containerClass = compact
    ? "w-full max-w-[320px] flex flex-col gap-3"
    : "w-full max-w-[320px] mb-8 flex flex-col gap-3";

  return (
    <>
      <div className={containerClass}>
        <label className="flex items-center gap-2 cursor-pointer mb-1">
          <div
            className={`flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
              allAgreed
                ? "bg-[#FFAAB8] border-[#FFAAB8]"
                : "bg-white border-stone-300"
            }`}
          >
            <Check
              strokeWidth={3}
              className={`w-3 h-3 ${allAgreed ? "text-white" : "text-stone-300"}`}
            />
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={allAgreed}
            onChange={handleAgreeAll}
          />
          <span className="text-sm font-semibold text-stone-800">
            전체 동의합니다.
          </span>
        </label>

        <hr className="border-stone-200" />

        <div className="flex flex-col gap-3.5 mt-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                  agreement.agreePrivacy
                    ? "bg-[#FFAAB8] border-[#FFAAB8]"
                    : "bg-white border-stone-300"
                }`}
              >
                <Check
                  strokeWidth={3}
                  className={`w-2.5 h-2.5 ${agreement.agreePrivacy ? "text-white" : "text-stone-300"}`}
                />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={agreement.agreePrivacy}
                onChange={() =>
                  onAgreementChange({
                    ...agreement,
                    agreePrivacy: !agreement.agreePrivacy,
                  })
                }
              />
              <span className="text-xs text-stone-600">
                (필수) 개인정보 수집 및 이용 동의
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="text-[10px] text-stone-400 underline"
            >
              보기
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                  agreement.agreeLocation
                    ? "bg-[#FFAAB8] border-[#FFAAB8]"
                    : "bg-white border-stone-300"
                }`}
              >
                <Check
                  strokeWidth={3}
                  className={`w-2.5 h-2.5 ${agreement.agreeLocation ? "text-white" : "text-stone-300"}`}
                />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={agreement.agreeLocation}
                onChange={() =>
                  onAgreementChange({
                    ...agreement,
                    agreeLocation: !agreement.agreeLocation,
                  })
                }
              />
              <span className="text-xs text-stone-600">
                (필수) 위치정보 수집 및 이용 동의
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="text-[10px] text-stone-400 underline"
            >
              보기
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                  agreement.agreeThirdParty
                    ? "bg-[#FFAAB8] border-[#FFAAB8]"
                    : "bg-white border-stone-300"
                }`}
              >
                <Check
                  strokeWidth={3}
                  className={`w-2.5 h-2.5 ${agreement.agreeThirdParty ? "text-white" : "text-stone-300"}`}
                />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={agreement.agreeThirdParty}
                onChange={() =>
                  onAgreementChange({
                    ...agreement,
                    agreeThirdParty: !agreement.agreeThirdParty,
                  })
                }
              />
              <span className="text-xs text-stone-600">
                (필수) 개인정보 제3자 제공 동의
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowThirdPartyModal(true)}
              className="text-[10px] text-stone-400 underline"
            >
              보기
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${
                  agreement.agreeMarketing
                    ? "bg-[#FFAAB8] border-[#FFAAB8]"
                    : "bg-white border-stone-300"
                }`}
              >
                <Check
                  strokeWidth={3}
                  className={`w-2.5 h-2.5 ${agreement.agreeMarketing ? "text-white" : "text-stone-300"}`}
                />
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={agreement.agreeMarketing}
                onChange={() =>
                  onAgreementChange({
                    ...agreement,
                    agreeMarketing: !agreement.agreeMarketing,
                  })
                }
              />
              <span className="text-xs text-stone-600">
                (선택) 마케팅 목적 이용 동의
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowMarketingModal(true)}
              className="text-[10px] text-stone-400 underline"
            >
              보기
            </button>
          </div>
        </div>
      </div>

      <TermsModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="개인정보 수집 및 이용 동의"
        content={PRIVACY_CONTENT}
      />
      <TermsModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        title="위치정보 수집 및 이용 동의"
        content={LOCATION_CONTENT}
      />
      <TermsModal
        isOpen={showThirdPartyModal}
        onClose={() => setShowThirdPartyModal(false)}
        title="개인정보 제3자 제공 동의"
        content={THIRD_PARTY_CONTENT}
      />
      <TermsModal
        isOpen={showMarketingModal}
        onClose={() => setShowMarketingModal(false)}
        title="마케팅 목적 이용 동의"
        content={MARKETING_CONTENT}
      />
    </>
  );
}
