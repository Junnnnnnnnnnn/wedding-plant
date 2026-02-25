"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface NotificationToastProps {
    show: boolean;
    onClose: () => void;
    senderName: string;
    message: string;
    senderImage?: string | null;
    roomId: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
    show,
    onClose,
    senderName,
    message,
    senderImage,
    roomId,
}) => {
    const router = useRouter();

    const handleNavigate = () => {
        router.push(`/chat/${roomId}`);
        onClose();
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0.6, bottom: 0.1 }}
                    onDragEnd={(_, info) => {
                        // 위쪽으로 20px 이상 드래그하면 닫기
                        if (info.offset.y < -20) {
                            onClose();
                        }
                    }}
                    initial={{ y: -100, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -100, opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", damping: 25, stiffness: 350 }}
                    className="fixed top-4 left-0 right-0 z-[9999] px-4 pointer-events-none"
                >
                    <div
                        onClick={handleNavigate}
                        className="max-w-md mx-auto bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(238,43,140,0.15)] rounded-2xl p-4 pointer-events-auto cursor-pointer group active:scale-[0.98] transition-transform"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#ee2b8c] to-[#ff7eb3] rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden">
                                {senderImage ? (
                                    <img src={senderImage} alt={senderName} className="w-full h-full object-cover" />
                                ) : (
                                    <MessageCircle className="w-5 h-5 fill-current" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0 pr-6">
                                <h4 className="text-sm font-black text-[#1b0d14] mb-0.5 truncate">
                                    {senderName}
                                </h4>
                                <p className="text-sm text-stone-600 line-clamp-2 leading-snug">
                                    {message}
                                </p>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                className="absolute top-3 right-3 p-1.5 text-stone-300 hover:text-stone-500 hover:bg-stone-100 rounded-full transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationToast;
