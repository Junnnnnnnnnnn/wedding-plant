"use client";

import Lottie from "lottie-react";
import { motion, useScroll, useTransform } from "motion/react";
import scrollAnimationData from "@/public/icons/lottieflow-scroll-down-03-000000-easey.json";

interface ScrollDownAnimationProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export default function ScrollDownAnimation({
  scrollContainerRef,
}: ScrollDownAnimationProps) {
  const { scrollY } = useScroll({ container: scrollContainerRef });

  // 스크롤이 0일 때 1, 100px 내려가면 0이 되도록 설정
  const opacity = useTransform(scrollY, [0, 80], [1, 0]);
  const scale = useTransform(scrollY, [0, 80], [1, 0.8]);

  return (
    <motion.div
      style={{ opacity, scale }}
      className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-16 h-16 flex flex-col items-center justify-center"
    >
      <div className="w-12 h-12 brightness-0">
        <Lottie animationData={scrollAnimationData} loop />
      </div>
    </motion.div>
  );
}
