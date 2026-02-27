"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import TermsModal from "./TermsModal";

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

const PRIVACY_CONTENT = `본 서비스는 개인정보보호법 제15조에 따라 아래와 같이 개인정보를 수집 및 이용합니다.

1. 수집 목적
- 회원 가입 및 서비스 제공
- 고객 상담 및 불만 처리
- 서비스 이용 기록 분석 및 개선

2. 수집 항목
- (필수) 이름, 이메일 주소, 프로필 이미지
- (필수) 소셜 로그인 식별자 (카카오톡, 구글, 네이버 등)

3. 보유 및 이용 기간
- 회원 탈퇴 시 지체 없이 파기
- 단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 법령에서 정한 기간 동안 보존합니다.

4. 동의 거부 권리
- 귀하는 개인정보 수집 및 이용에 대해 동의를 거부할 권리가 있습니다. 단, 필수 항목 동의 거부 시 서비스 이용이 제한될 수 있습니다.`;

const LOCATION_CONTENT = `본 서비스는 위치정보의 보호 및 이용 등에 관한 법률 제15조에 따라 아래와 같이 위치정보를 수집 및 이용합니다.

1. 수집 목적
- 예식장 위치 안내 및 하객 길찾기 서비스 제공
- 위치 기반 웨딩 일정 관리 및 알림 기능 제공

2. 수집 항목
- (필수) GPS 좌표 (위도, 경도) 및 장소 정보

3. 보유 및 이용 기간
- 서비스 제공 목적 달성 시 또는 회원 탈퇴 시 지체 없이 파기합니다.

4. 동의 거부 권리
- 귀하는 위치정보 수집 및 이용에 대해 동의를 거부할 권리가 있습니다. 단, 동의 거부 시 위치 기반 기능(길안내 등) 이용이 제한됩니다.`;

const THIRD_PARTY_CONTENT = `본 서비스는 개인정보보호법 제17조에 따라 아래와 같이 개인정보를 제3자에게 제공합니다.

1. 제공받는 자
- 동일한 웨딩 플랜 룸(공유 룸)에 참여 및 초대된 다른 사용자

2. 제공 목적
- 일정, 예산, 채팅 등 웨딩 준비 데이터의 공동 관리 및 원활한 커뮤니케이션

3. 제공 항목
- (필수) 이름, 프로필 이미지, 채팅 내역, 일정 및 예산 입력 정보

4. 보유 및 이용 기간
- 웨딩 플랜 룸 참여 기간 동안 유지되며, 퇴장 시 또는 회원 탈퇴 시 파기됩니다.

5. 동의 거부 권리
- 귀하는 개인정보 제3자 제공에 대해 동의를 거부할 권리가 있습니다. 단, 동의 거부 시 플랜 공유 룸 기능 및 협업 서비스 이용이 불가능합니다.`;

const MARKETING_CONTENT = `1. 수집 및 이용 목적
- 신규 서비스 및 업데이트 안내
- 이벤트, 프로모션 알림 및 혜택 제공
- 맞춤형 웨딩 정보 및 광고 전송 (앱 푸시, 이메일, 알림톡 등)

2. 수집 항목
- (선택) 이름, 이메일 주소, 서비스 이용 기록

3. 보유 및 이용 기간
- 회원 탈퇴 시 또는 마케팅 목적 이용 동의 철회 시까지 보관 및 이용됩니다.

4. 동의 거부 권리
- 귀하는 마케팅 목적 이용에 대한 동의를 선택적으로 거부하실 수 있습니다. 동의를 거부하셔도 웨딩 플랜트의 기본 서비스는 정상적으로 이용하실 수 있습니다.`;

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
