"use client";

import React from "react";
import { AlertCircle, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CustomAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  type?: "warning" | "error" | "info" | "success";
}

const CustomAlertModal: React.FC<CustomAlertModalProps> = ({
  isOpen,
  onClose,
  message,
  type = "warning",
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "error":
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      case "success":
        return <Check className="w-8 h-8 text-green-500" />;
      case "info":
        return <AlertCircle className="w-8 h-8 text-blue-500" />;
      default:
        return <AlertCircle className="w-8 h-8 text-[#ee2b8c]" />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case "error":
        return "bg-red-500 hover:bg-red-600";
      case "success":
        return "bg-green-500 hover:bg-green-600";
      case "info":
        return "bg-blue-500 hover:bg-blue-600";
      default:
        return "bg-[#ee2b8c] hover:bg-[#d4237b]";
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-[4px]"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Accent */}
          <div
            className={`h-1.5 w-full ${type === "warning" ? "bg-[#ee2b8c]" : type === "error" ? "bg-red-500" : type === "success" ? "bg-green-500" : "bg-blue-500"}`}
          />

          <div className="p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 bg-gray-50 rounded-2xl">{getIcon()}</div>

              <h3 className="text-xl font-bold text-[#1b0d14] mb-2 leading-tight">
                알림
              </h3>

              <p className="text-gray-600 font-medium break-keep">{message}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`mt-8 w-full py-4 rounded-2xl text-white font-bold text-lg transition-all active:scale-[0.98] shadow-lg ${getButtonColor()}`}
            >
              확인
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CustomAlertModal;
