"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ChevronLeft,
    Send,
    Image as ImageIcon,
    Smile,
    MoreVertical,
    CheckCheck,
    Crown,
    Pencil,
} from "lucide-react";
import { useApi } from "../../contexts/ApiContext";
import { setReturnPathAfterLogin } from "@/lib/api";
import LoginRequiredModal from "../../components/LoginRequiredModal";

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    senderImage?: string | null;
    text: string;
    timestamp: string;
    isMe: boolean;
}

interface RoomMember {
    planUserId: string;
    name: string;
    image: string | null;
    permission: string;
}

interface RoomResponse {
    data?: {
        name: string;
        members: RoomMember[];
        weddingDate?: string;
        budget?: number;
        id?: string;
    };
    result: boolean;
}

const AVATAR_GRADIENTS = [
    "linear-gradient(135deg, #ee2b8c 0%, #ff7eb3 100%)",
    "linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%)",
    "linear-gradient(135deg, #059669 0%, #34d399 100%)",
    "linear-gradient(135deg, #d97706 0%, #fbbf24 100%)",
    "linear-gradient(135deg, #0ea5e9 0%, #7dd3fc 100%)",
];

const MOCK_MESSAGES: Message[] = [
    {
        id: "1",
        senderId: "other",
        senderName: "예신이",
        text: "자기야, 우리 웨딩홀 투어 예약 언제였지?",
        timestamp: "오전 10:15",
        isMe: false,
    },
    {
        id: "2",
        senderId: "me",
        senderName: "예랑이",
        text: "이번 주 토요일 오후 2시야! 잊은 거 아니지? ㅎㅎ",
        timestamp: "오전 10:16",
        isMe: true,
    },
    {
        id: "3",
        senderId: "other",
        senderName: "예신이",
        text: "아 맞다! 고마워~ 플래너님이 체크리스트도 보내주셨더라.",
        timestamp: "오전 10:18",
        isMe: false,
    },
    {
        id: "4",
        senderId: "me",
        senderName: "예랑이",
        text: "오 보이면 나도 좀 보여줘! 같이 보자.",
        timestamp: "오전 10:20",
        isMe: true,
    },
];

export default function ChatPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();
    const { fetchWithAuth } = useApi();
    const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
    const [inputValue, setInputValue] = useState("");
    const [roomName, setRoomName] = useState("플랜톡");
    const [members, setMembers] = useState<RoomMember[]>([]);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [viewportHeight, setViewportHeight] = useState("100dvh");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window === "undefined" || !window.visualViewport) return;

        const handleResize = () => {
            const height = window.visualViewport?.height;
            if (height) {
                setViewportHeight(`${height}px`);
                // Scroll to bottom when keyboard appears
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            }
        };

        window.visualViewport.addEventListener("resize", handleResize);
        window.visualViewport.addEventListener("scroll", handleResize);
        return () => {
            window.visualViewport?.removeEventListener("resize", handleResize);
            window.visualViewport?.removeEventListener("scroll", handleResize);
        };
    }, []);

    useEffect(() => {
        const fetchRoomInfo = async () => {
            try {
                const res = await fetchWithAuth(`/plan/room/${roomId}`);
                if (res.status === 401) {
                    setReturnPathAfterLogin(`/chat/${roomId}`);
                    setShowLoginModal(true);
                    return;
                }
                const json: RoomResponse = await res.json();
                if (json.result && json.data) {
                    setRoomName(`${json.data.name}님의 웨딩 플랜`);
                    setMembers(json.data.members ?? []);
                }
            } catch (err) {
                console.error("Failed to fetch room info:", err);
            }
        };
        if (roomId) fetchRoomInfo();
    }, [roomId, fetchWithAuth]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            senderId: "me",
            senderName: "예랑이",
            text: inputValue,
            timestamp: new Date().toLocaleTimeString("ko-KR", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            }),
            isMe: true,
        };

        setMessages([...messages, newMessage]);
        setInputValue("");
    };

    const handleCloseLoginModal = () => {
        setShowLoginModal(false);
        router.replace("/");
    };

    return (
        <>
            <div
                className="bg-[#fcfbfc] overflow-hidden"
                style={{ height: viewportHeight, fontFamily: "var(--font-tmoney), sans-serif" }}
            >
                {/* Desktop Letterbox Background */}
                <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />

                <div className="h-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col z-10">
                    {/* Header */}
                    <header className="flex items-center justify-between px-4 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex-shrink-0 z-50">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.back()}
                                className="p-1 -ml-1 text-stone-600"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-xl font-normal text-[#1b0d14] max-w-[200px] truncate leading-tight tracking-tight">
                                    {roomName}
                                </h1>
                                <p className="text-[10px] text-stone-400 font-medium mt-1 truncate max-w-[200px]">
                                    {members.length > 0
                                        ? members.map((m) => m.name).join(", ")
                                        : "대화 중인 멤버"}
                                </p>
                            </div>
                        </div>
                        <button className="p-2 text-stone-400">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </header>

                    {/* Message List */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide space-y-6"
                    >
                        <div className="flex justify-center my-4">
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100/50 px-3 py-1 rounded-full uppercase tracking-wider">
                                2026년 2월 23일
                            </span>
                        </div>

                        {messages.map((msg, idx) => {
                            const { isMe } = msg;
                            const showAvatar =
                                !isMe &&
                                (idx === 0 || messages[idx - 1].senderId !== msg.senderId);

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}
                                >
                                    {!isMe && (
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ffaab8] to-[#ff94a1] flex-shrink-0 mb-1 flex items-center justify-center text-white text-[10px] font-black shadow-sm">
                                            {msg.senderName.charAt(0)}
                                        </div>
                                    )}

                                    <div
                                        className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[70%]`}
                                    >
                                        {!isMe && showAvatar && (
                                            <span className="text-[10px] font-bold text-gray-400 mb-1 ml-1">
                                                {msg.senderName}
                                            </span>
                                        )}
                                        <div
                                            className={`px-4 py-2.5 rounded-[20px] text-sm font-medium shadow-sm leading-relaxed ${isMe
                                                    ? "bg-[#ee2b8c] text-white rounded-tr-none"
                                                    : "bg-white text-stone-800 border border-gray-100 rounded-tl-none"
                                                }`}
                                        >
                                            {msg.text}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-0.5 mb-1 flex-shrink-0">
                                        {isMe && (
                                            <CheckCheck className="w-3.5 h-3.5 text-[#ee2b8c]" />
                                        )}
                                        <span className="text-[9px] font-bold text-gray-300">
                                            {msg.timestamp}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input Bar */}
                    <div className="px-4 py-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex-shrink-0">
                        <div className="flex items-center gap-2 max-w-md mx-auto">
                            <button className="flex items-center justify-center shrink-0 w-11 h-11 bg-gray-50 text-stone-400 rounded-2xl hover:bg-gray-100 transition-colors">
                                <ImageIcon className="w-5 h-5" />
                            </button>
                            <div className="flex-1 min-w-0 relative flex items-center">
                                <textarea
                                    rows={1}
                                    value={inputValue}
                                    onChange={(e) => {
                                        setInputValue(e.target.value);
                                        e.target.style.height = "auto";
                                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                            e.currentTarget.style.height = "auto";
                                        }
                                    }}
                                    placeholder="메시지를 입력하세요..."
                                    className="w-full bg-gray-50 text-stone-800 text-sm font-medium rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#ee2b8c33] transition-all resize-none overflow-y-auto no-scrollbar min-h-[44px]"
                                    style={{
                                        maxHeight: "120px",
                                        fontFamily: "var(--font-tmoney), sans-serif",
                                    }}
                                />
                                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-300 hover:text-stone-500">
                                    <Smile className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                className={`flex items-center justify-center shrink-0 w-11 h-11 rounded-2xl transition-all shadow-lg active:scale-95 ${inputValue.trim()
                                        ? "bg-[#ee2b8c] text-white shadow-[#ee2b8c44]"
                                        : "bg-gray-200 text-gray-400 shadow-none"
                                    }`}
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <LoginRequiredModal
                show={showLoginModal}
                onClose={handleCloseLoginModal}
                title="플랜 채팅을 이용하려면 로그인해 주세요"
            />
        </>
    );
}
