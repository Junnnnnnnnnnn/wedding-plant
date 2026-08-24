"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";

export interface GuideStep {
  id: string; // DOM ID of the target element
  title?: string;
  description: string;
  /** 스팟라이트 위치 미세 조정 (px) */
  spotlightOffset?: { left?: number; top?: number };
  /** 말풍선 위치: 'above' = 스팟라이트 위, 'below' = 아래 (기본값: 공간에 따라 자동) */
  tooltipPosition?: "above" | "below";
  /** 말풍선 가로 정렬: 'center' = 화면 가운데 (기본값: 스팟라이트 기준) */
  tooltipAlign?: "center";
}

interface GuideOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  steps: GuideStep[];
}

export default function GuideOverlay({
  isOpen,
  onClose,
  steps,
}: GuideOverlayProps) {
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const wasOpenRef = useRef(false);

  // Ensure we only render on the client
  useEffect(() => {
    setMounted(true);
    // Prevent body scroll when open
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 처음 열릴 때 첫 번째 스텝 스팟라이트 자동 표시
  //
  // 호출하는 세 페이지 모두 guideSteps 를 렌더마다 새 배열로 만들기 때문에,
  // steps 를 의존성으로 두고 무조건 첫 스텝으로 되돌리면 부모가 리렌더될
  // 때마다(예: SSE 미읽음 수 변경) 가이드가 1단계로 튕겼다.
  // 닫힘 → 열림으로 바뀌는 순간에만 초기화한다.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current && steps.length > 0) {
      setActiveStepId(steps[0].id);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, steps]);

  // Update rect on resize or scroll
  const updateRect = useCallback(() => {
    if (activeStepId) {
      const el = document.getElementById(activeStepId);
      const r = el?.getBoundingClientRect();
      // 숨은 엘리먼트(display:none)도 rect 자체는 돌아온다 — 전부 0 이다.
      // 그대로 쓰면 스팟라이트가 좌상단 0×0 으로 붕괴하고 말풍선은
      // maxWidth:0 이 되어 화면만 까맣게 덮인다. 없는 것으로 친다.
      setTargetRect(r && r.width > 0 && r.height > 0 ? r : null);
    } else {
      setTargetRect(null);
    }
  }, [activeStepId]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true); // Capture scroll
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect]);

  /*
   * 화면 밖에 있는 대상은 끌어온다.
   * 폭에 따라 열 수가 달라지면(대시보드가 1열로 접히는 768 등) 뒤쪽 스텝이
   * 스크롤 아래로 내려간다. 그때 스팟라이트만 그리면 아무것도 안 보인다.
   * 스크롤 이벤트는 위 updateRect 가 캡처로 듣고 있어 좌표는 따라온다.
   */
  useEffect(() => {
    if (!isOpen || !activeStepId) return;
    const el = document.getElementById(activeStepId);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [isOpen, activeStepId]);

  const handleOverlayClick = () => {
    // 활성 스텝이 없으면 클릭 무시
    if (!activeStepId) return;

    const currentIndex = steps.findIndex((s) => s.id === activeStepId);
    if (currentIndex < steps.length - 1) {
      setActiveStepId(steps[currentIndex + 1].id);
    } else {
      onClose();
    }
  };

  const activeStep = steps.find((s) => s.id === activeStepId);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] touch-none"
        onClick={handleOverlayClick}
      >
        {/*
          Implementation Strategy:
          We use a 'mask' approach visually.
          Case 1: No active step. Whole screen is semi-transparent black.
          Case 2: Active step. We render a div at the target position.
                 It has a huge box-shadow to darken the REST of the screen.
                 The div itself is transparent (the hole).
        */}

        {activeStepId && targetRect && (
          <>
            {/* The "Hole" with Spotlight execution */}
            {(() => {
              const offset = activeStep?.spotlightOffset ?? {};
              const top = targetRect.top + (offset.top ?? 0);
              const left = targetRect.left + (offset.left ?? 0);
              return (
                <motion.div
                  layoutId="spotlight"
                  className="absolute bg-transparent rounded-xl cursor-pointer transition-all duration-300 ease-out"
                  style={{
                    top,
                    left,
                    width: targetRect.width,
                    height: targetRect.height,
                    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
                  }}
                  initial={false}
                  animate={{
                    top,
                    left,
                    width: targetRect.width,
                    height: targetRect.height,
                  }}
                />
              );
            })()}

            {/* Tooltip - 스팟라이트와 가깝게 배치 */}
            {(() => {
              const offset = activeStep?.spotlightOffset ?? {};
              const spotlightLeft = targetRect.left + (offset.left ?? 0);
              const forceAbove = activeStep?.tooltipPosition === "above";
              const forceBelow = activeStep?.tooltipPosition === "below";
              const isAbove =
                forceAbove ||
                (!forceBelow && targetRect.bottom + 100 > window.innerHeight);
              const tooltipTop = isAbove
                ? Math.max(10, targetRect.top - 120)
                : targetRect.bottom + 12;
              const centerAlign = activeStep?.tooltipAlign === "center";
              return (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    top: tooltipTop,
                    ...(centerAlign
                      ? {
                          left: "50%",
                          right: "auto",
                          transform: "translateX(-50%)",
                          maxWidth: "min(384px, calc(100vw - 2rem))",
                        }
                      : isAbove
                        ? {
                            left: spotlightLeft,
                            right: "auto",
                            maxWidth: Math.min(384, targetRect.width),
                          }
                        : {
                            left: 0,
                            right: 0,
                            display: "flex",
                            justifyContent: "center",
                          }),
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={activeStepId}
                    className={`bg-white text-gray-900 px-5 py-4 rounded-xl shadow-2xl border border-white/20 relative ${isAbove && !centerAlign ? "max-w-sm" : "max-w-sm w-full mx-4"}`}
                  >
                    {/* Arrow - naive implementation */}
                    <div className="font-bold text-lg mb-1 text-[#ee2b8c]">
                      {activeStep?.title}
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed font-medium">
                      {activeStep?.description}
                    </div>
                  </motion.div>
                </div>
              );
            })()}
          </>
        )}

        {/*
          앵커를 못 찾았을 때. 예전에는 까만 배경만 깔아 글이 아예 안 보였다.
          비출 곳이 없을 뿐 할 말은 있으므로 말풍선을 화면 가운데 띄운다.
        */}
        {activeStepId && !targetRect && (
          <>
            <div className="absolute inset-0 bg-black/60 transition-colors duration-300" />
            <div className="absolute inset-0 z-10 flex items-center justify-center px-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={activeStepId}
                className="bg-white text-gray-900 px-5 py-4 rounded-xl shadow-2xl border border-white/20 max-w-sm w-full"
              >
                <div className="font-bold text-lg mb-1 text-[#ee2b8c]">
                  {activeStep?.title}
                </div>
                <div className="text-sm text-gray-600 leading-relaxed font-medium">
                  {activeStep?.description}
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-6 right-6 p-2 bg-white/20 text-white rounded-full hover:bg-white/30 backdrop-blur-md transition-colors z-50 pointer-events-auto"
        >
          <X className="w-6 h-6" />
        </button>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
