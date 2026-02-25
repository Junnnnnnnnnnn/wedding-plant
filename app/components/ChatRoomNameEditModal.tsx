"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Loader2 } from "lucide-react";

interface ChatRoomNameEditModalProps {
    show: boolean;
    onClose: () => void;
    currentName: string;
    onUpdate: (newName: string) => Promise<void>;
}

const ChatRoomNameEditModal: React.FC<ChatRoomNameEditModalProps> = ({
    show,
    onClose,
    currentName,
    onUpdate,
}) => {
    const [name, setName] = useState(currentName);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            setName(currentName);
        }
    }, [show, currentName]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || name === currentName) return;

        setLoading(true);
        try {
            await onUpdate(name.trim());
            onClose();
        } catch (error) {
            console.error("Failed to update chat room name:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-[#1b0d14]/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4">
                            <button
                                onClick={onClose}
                                className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-50 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-2xl font-black text-[#1b0d14] tracking-tight mb-2 text-center">
                                채팅방 이름 변경
                            </h2>
                            <p className="text-stone-400 text-sm font-medium text-center">
                                어울리는 새로운 이름을 입력해 주세요.
                            </p>
                        </div>

                        <form onSubmit={handleUpdate} className="space-y-6">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="채팅방 이름을 입력하세요"
                                    autoFocus
                                    className="w-full bg-stone-50 text-[#1b0d14] text-lg font-bold rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#ee2b8c33] border-2 border-transparent focus:border-[#ee2b8c11] transition-all placeholder:text-stone-300"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 h-14 bg-stone-100 text-stone-500 font-bold rounded-2xl hover:bg-stone-200 transition-all active:scale-95"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !name.trim() || name === currentName}
                                    className={`flex-1 h-14 font-bold rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${!name.trim() || name === currentName
                                            ? "bg-stone-100 text-stone-300 shadow-none"
                                            : "bg-[#ee2b8c] text-white shadow-[#ee2b8c33]"
                                        }`}
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="w-5 h-5" strokeWidth={3} />
                                            수정하기
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ChatRoomNameEditModal;
