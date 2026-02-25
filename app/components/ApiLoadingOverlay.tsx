"use client";

import { motion, AnimatePresence } from "motion/react";
import { useApi } from "@/app/contexts/ApiContext";

export default function ApiLoadingOverlay() {
  const { loading } = useApi();

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/40 backdrop-blur-[6px]"
          aria-busy
          aria-live="polite"
          aria-label="데이터를 불러오는 중입니다"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="flex flex-col items-center gap-5 p-8 rounded-[40px] bg-white/80 shadow-[0_32px_64px_-16px_rgba(238,43,140,0.15)] border border-white"
          >
            <div className="relative">
              {/* Outer pulsing ring */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full bg-[#ee2b8c]"
              />

              {/* Main spinner container */}
              <div className="relative h-16 w-16 flex items-center justify-center rounded-full bg-white shadow-inner">
                <svg
                  className="h-10 w-10 animate-spin text-[#ee2b8c]"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-10"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            </div>

            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center gap-1"
            >
              <span
                className="text-lg font-black text-[#1b0d14] tracking-tight"
                style={{ fontFamily: "var(--font-tmoney), sans-serif" }}
              >
                잠시만 기다려주세요
              </span>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] ml-1">
                Loading...
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
