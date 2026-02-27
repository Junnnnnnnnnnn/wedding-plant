"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type PlanSortOption =
  | "price_desc"
  | "price_asc"
  | "date_desc"
  | "date_asc"
  | "name_desc"
  | "name_asc";

const SORT_OPTIONS: { value: PlanSortOption; label: string }[] = [
  { value: "price_asc", label: "낮은 가격순" },
  { value: "price_desc", label: "높은 가격순" },
  { value: "date_asc", label: "플랜 시작일 오래된순" },
  { value: "date_desc", label: "플랜 시작일 최신순" },
  { value: "name_asc", label: "제목 가나다순" },
  { value: "name_desc", label: "제목 가나다역순" },
];

type PlanFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sortOptions: PlanSortOption[];
  onSortChange: (sorts: PlanSortOption[]) => void;
};

export default function PlanFilterModal({
  isOpen,
  onClose,
  sortOptions,
  onSortChange,
}: PlanFilterModalProps) {
  if (!isOpen) return null;

  const selectedSort = sortOptions[0] ?? "date_desc";

  const handleSelect = (opt: PlanSortOption) => {
    onSortChange([opt]);
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-t-[44px] px-5 sm:px-6 pt-8 pb-10 sm:pb-12 shadow-2xl overflow-hidden relative flex flex-col max-h-[calc(100dvh-120px)] min-h-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#ee2b8c] to-[#ff94a1]" />

          <header className="flex justify-between items-center mb-6 flex-shrink-0">
            <h3 className="text-xl sm:text-2xl font-black text-[#1b0d14] tracking-tight">
              정렬
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
              aria-label="닫기"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
            </button>
          </header>

          <div className="overflow-y-auto flex-1 min-h-0 -mx-2 px-2 scrollbar-hide">
            <ul className="space-y-1">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = selectedSort === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full text-left px-4 py-3.5 rounded-xl font-semibold text-[15px] transition-all ${
                        isSelected
                          ? "bg-[#ee2b8c] text-white"
                          : "bg-stone-50 text-stone-700 hover:bg-stone-100 active:scale-[0.99]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
