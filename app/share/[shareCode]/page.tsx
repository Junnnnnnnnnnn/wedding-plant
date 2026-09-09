"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getToken, setShareAfterLogin, clearToken } from "@/lib/api";
import { useApi } from "@/app/contexts/ApiContext";
import LoginRequiredModal from "@/app/components/LoginRequiredModal";
import { useKakaoAuth } from "@/app/hooks/useKakaoAuth";

const joinedCodes = new Set<string>();

export default function SharePage() {
  const router = useRouter();
  const params = useParams();
  const shareCode = params.shareCode as string;
  /*
    초대 링크가 역할을 지닌다(`?as=spouse`). 로그인 전이면 코드와 함께
    저장해 두었다가 로그인 후 같은 역할로 참여시킨다 — 코드만 저장하면
    배우자로 초대받고도 함께 보는 사람으로 들어간다.
  */
  const searchParams = useSearchParams();
  const asRole = searchParams.get("as") === "spouse" ? "spouse" : null;
  const shareKey = asRole ? `${shareCode}?as=${asRole}` : shareCode;
  const { fetchWithAuth } = useApi();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const { handleKakaoAuth, loading: authLoading } = useKakaoAuth();

  useEffect(() => {
    if (!shareCode) return;

    const token = getToken();
    if (!token) {
      setShareAfterLogin(shareKey);
      setShowLoginModal(true);
      return;
    }

    if (joinedCodes.has(shareKey)) return;
    joinedCodes.add(shareKey);

    const joinRoom = async () => {
      try {
        // 여기만은 공통 401 처리에 맡기지 않는다. 공유 코드를 다시
        // 저장해야(setShareAfterLogin) 재로그인 후 참여가 이어지고,
        // joinedCodes 에서도 빼 줘야 재시도가 가능하다. 공통 처리는
        // 복귀 경로만 저장하므로 이 둘을 대신하지 못한다.
        const res = await fetchWithAuth(
          `/plan/room/${shareCode}${asRole ? `?as=${asRole}` : ""}`,
          { method: "POST", skipAuthHandling: true },
        );
        if (res.status === 401) {
          clearToken();
          setShareAfterLogin(shareKey);
          setShowLoginModal(true);
          joinedCodes.delete(shareKey);
          return;
        }
        if (res.ok) {
          router.replace("/plan-list");
          return;
        }
        // 성공이 아니면 반드시 사용자에게 알린다.
        // (else가 없어 잘못된 코드·중복 참여·정원 초과 시 스피너로 멈춰 있었음)
        joinedCodes.delete(shareKey);
        setJoinError(
          res.status === 404
            ? "존재하지 않는 공유 링크입니다. 링크를 다시 확인해 주세요."
            : "플랜에 참여하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      } catch (err) {
        joinedCodes.delete(shareKey);
        setJoinError(
          "네트워크 오류로 참여하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.",
        );
        console.error("Failed to join room:", err);
      }
    };

    joinRoom();
  }, [shareCode, shareKey, asRole, fetchWithAuth, router]);

  const handleCloseModal = () => {
    setShowLoginModal(false);
    router.replace("/");
  };

  const handleRetry = () => {
    setJoinError(null);
    joinedCodes.delete(shareKey);
    router.refresh();
    // effect가 다시 돌도록 코드 재설정 없이 강제 리로드
    window.location.reload();
  };

  /*
    로그인 전이면 **초대 화면**을 낸다. 예전에는 회색 배경 위에 "공유 플랜을
    보려면 로그인해 주세요" 모달 하나였는데, 초대받은 사람은 누가 왜 불렀는지
    모른 채 로그인부터 요구받았다 — 이 앱을 처음 보는 사람에게 가장 나쁜
    첫 화면이다.

    지금 확실히 아는 것만 적는다: **초대를 받았다는 사실**과 **어떤 자격인지**
    (`?as=spouse` 는 URL 에 있으므로 로그인 전에도 안다). 초대한 사람의 이름과
    결혼식 날짜는 공개 조회 엔드포인트가 없어 아직 못 보여 준다 — 지어내지 않는다.
  */
  if (!joinError && showLoginModal) {
    return (
      <div className="flex min-h-screen w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#ee2b8c] to-[#ff5c95] px-8 pb-10 pt-20">
        <div className="w-full max-w-md">
          <div className="inline-flex items-center justify-center rounded-[20px] bg-white p-2.5 shadow-lg shadow-black/10">
            <Image
              src="/images/icon.png"
              alt="웨딩 플랜트"
              width={128}
              height={128}
              quality={100}
              className="h-11 w-11 rounded-[12px] object-contain"
            />
          </div>

          {/*
            시안(C안 12)의 **흰 카드**다. 분홍 위의 반투명 상자는 배경과
            같은 색이라 "여기가 초대장"이라는 덩어리가 안 잡혔다.

            카드에 초대한 사람 이름·결혼식 날짜·D-day 를 적는 시안 자리는
            비워 둔다 — **공개 조회 엔드포인트가 없다.** 로그인 전에 확실히
            아는 건 초대를 받았다는 사실과 `?as=spouse` 로 실려 온 자격뿐이고,
            그 둘만 적는다. 지어내지 않는다.
          */}
          <div className="mt-6 rounded-[24px] bg-white p-6">
            <p className="text-[13px] font-bold text-[#cc1873]">
              초대를 받았어요
            </p>
            <h1 className="mt-2 text-[24px] font-bold leading-[1.3] tracking-[-0.03em] text-[#1a1c20]">
              함께 준비하자고
              <br />
              불렀어요
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[#555d6d]">
              카카오로 시작하면 바로 참여돼요.
            </p>

            <div className="mt-5 rounded-xl bg-[#fff1f7] px-4 py-3.5">
              <p className="text-[13px] font-bold leading-relaxed text-[#cc1873]">
                {asRole === "spouse"
                  ? "신랑 · 신부로 초대받았어요"
                  : "함께 보는 사람으로 초대받았어요"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#555d6d]">
                {asRole === "spouse"
                  ? "일정과 예산을 같이 보고, 같이 고칠 수 있어요."
                  : "일정과 예산을 같이 볼 수 있어요. 대화도 함께해요."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-md flex-col items-center">
          <button
            type="button"
            onClick={handleKakaoAuth}
            disabled={authLoading}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FEE500] text-[16px] font-bold text-[#191919] transition-transform active:scale-[0.99] disabled:opacity-70"
          >
            {authLoading ? "확인 중..." : "카카오로 시작하고 참여하기"}
          </button>
          {/* 빠져나갈 길. 예전의 "닫기" 는 눌러도 갈 곳이 없었다 */}
          <button
            type="button"
            onClick={() => router.replace("/setting")}
            className="mt-4 text-xs font-medium text-white/70 underline underline-offset-4"
          >
            지금은 그냥 둘러볼게요
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfbfc] flex items-center justify-center px-6">
      {joinError ? (
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl text-center">
          <p className="text-lg font-bold text-[#1b0d14]">
            플랜에 참여하지 못했어요
          </p>
          <p className="mt-2 text-sm text-gray-500">{joinError}</p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="flex-1 h-12 rounded-2xl border border-gray-200 bg-white font-bold text-sm text-[#1b0d14] hover:bg-gray-50 transition-all"
            >
              홈으로
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 h-12 rounded-2xl bg-[#ee2b8c] font-bold text-sm text-white hover:bg-[#d4237b] transition-all"
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : (
        !showLoginModal && (
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-[#ee2b8c] border-t-transparent animate-spin" />
            <p className="text-gray-400 font-bold text-sm">
              공유 플랜 연결 중...
            </p>
          </div>
        )
      )}

      <LoginRequiredModal
        show={showLoginModal}
        onClose={handleCloseModal}
        title="공유 플랜을 보려면 로그인해 주세요"
      />
    </div>
  );
}
