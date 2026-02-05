import React, { useState } from "react";
import {
  X,
  Link2,
  MessageCircle,
  Shield,
  ShieldAlert,
  Check,
  Copy,
} from "lucide-react";

interface SharePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SharePlanModal: React.FC<SharePlanModalProps> = ({ isOpen, onClose }) => {
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      "https://wedding-plan.example.com/share/jh28-x92",
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm px-4 pb-[75px]"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-t-[44px] p-8 shadow-2xl transition-all animate-in fade-in slide-in-from-bottom duration-300 overflow-hidden relative flex flex-col max-h-[calc(100dvh-140px)] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#ee2b8c] to-[#ff94a1]" />

        <header className="flex justify-between items-center mb-8 flex-shrink-0">
          <div>
            <h3 className="text-2xl font-black text-[#1b0d14] tracking-tight">
              플랜 공유하기
            </h3>
            <p className="text-gray-400 text-xs font-bold mt-1">
              함께 관리할 사람들을 초대하세요
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="space-y-8 overflow-y-auto flex-1 min-h-0 scrollbar-hide -mx-2 px-2 pb-2">
          {/* Main Illustration/Description */}
          <div className="bg-[#ee2b8c08] rounded-3xl p-6 text-center border border-[#ee2b8c11]">
            <p className="text-[#1b0d14] font-bold text-sm leading-relaxed">
              연인이나 플랜 전문가 등에게
              <br />
              플랜을 공유하고 수정해봐요!
            </p>
            <div className="mt-3 inline-block px-3 py-1 bg-[#ff940011] rounded-full">
              <p className="text-[#ff9400] text-[11px] font-black uppercase tracking-wider">
                최대 4명까지 가능합니다.
              </p>
            </div>
          </div>

          {/* Permission Toggle */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">
              접근 권한 설정
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPermission("view")}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all ${
                  permission === "view"
                    ? "border-[#ee2b8c] bg-[#ee2b8c08]"
                    : "border-gray-100 bg-white opacity-60"
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${permission === "view" ? "bg-[#ee2b8c] text-white" : "bg-gray-100 text-gray-400"}`}
                >
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-[#1b0d14]">읽기 전용</p>
                  <p className="text-[10px] font-bold text-gray-400">
                    조회만 가능
                  </p>
                </div>
              </button>

              <button
                onClick={() => setPermission("edit")}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl border-2 transition-all ${
                  permission === "edit"
                    ? "border-[#ee2b8c] bg-[#ee2b8c08]"
                    : "border-gray-100 bg-white opacity-60"
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${permission === "edit" ? "bg-[#ee2b8c] text-white" : "bg-gray-100 text-gray-400"}`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-[#1b0d14]">
                    읽기 및 쓰기
                  </p>
                  <p className="text-[10px] font-bold text-gray-400">
                    자유롭게 수정
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Sharing Methods */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">
              공유 방법 선택
            </h4>
            <div className="flex gap-4">
              <button
                onClick={handleCopyLink}
                className="flex-1 h-16 bg-white border border-gray-100 rounded-3xl flex items-center justify-center gap-3 font-bold text-[#1b0d14] shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Link2 className="w-5 h-5 text-[#ee2b8c]" />
                )}
                {copied ? "복사됨" : "링크 복사"}
              </button>

              <button className="w-16 h-16 bg-[#FEE500] rounded-3xl flex items-center justify-center shadow-lg shadow-[#FEE50033] hover:opacity-90 active:scale-95 transition-all flex-shrink-0">
                <MessageCircle className="w-7 h-7 text-[#1b0d14] fill-[#1b0d14]" />
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={onClose}
            className="w-full h-16 bg-[#ee2b8c] text-white rounded-3xl font-black text-lg shadow-xl shadow-[#ee2b8c33] transition-all hover:bg-[#d4237b] active:scale-95 mt-4 flex-shrink-0"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePlanModal;
