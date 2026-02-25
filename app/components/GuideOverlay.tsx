"use client";

import { useEffect, useState, useCallback } from "react";
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
  useEffect(() => {
    if (isOpen && steps.length > 0) {
      // Always start with the first step
      setActiveStepId(steps[0].id);
    }
  }, [isOpen, steps]);

  // Update rect on resize or scroll
  const updateRect = useCallback(() => {
    if (activeStepId) {
      const el = document.getElementById(activeStepId);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
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

        {/* Fallback dark background when target is not yet ready */}
        {activeStepId && !targetRect && (
          <div className="absolute inset-0 bg-black/60 transition-colors duration-300" />
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
