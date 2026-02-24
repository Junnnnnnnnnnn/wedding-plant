"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  ChevronLeft,
  Send,
  Image as ImageIcon,
  Smile,
  MoreVertical,
  CheckCheck,
  User,
  ExternalLink,
} from "lucide-react";
import { useApi } from "../../contexts/ApiContext";
import {
  getToken,
  setReturnPathAfterLogin,
  clearToken,
  getPlanUserIdFromToken,
  getApiBaseUrl,
} from "@/lib/api";
import LoginRequiredModal from "../../components/LoginRequiredModal";

interface ScheduleData {
  categoryName: string;
  title: string;
  amount: number;
  status: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderImage?: string | null;
  messageType: "text" | "schedule";
  text?: string;
  schedule?: ScheduleData | null;
  timestamp: string; // "오전 10:30"
  fullDate: string; // "2026-02-24"
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

interface ChatHistoryItem {
  id: string;
  planUserId: string;
  planUserName: string;
  planUserProfileImageUrl?: string | null;
  messageType: "text" | "schedule";
  text?: string;
  schedule?: ScheduleData | null;
  createDate: string;
}

interface SocketMessagePayload {
  senderId: string;
  senderName: string;
  senderProfileImageUrl?: string | null;
  message: {
    messageType: "text" | "schedule";
    text?: string;
    schedule?: ScheduleData | null;
  };
}

const AVATAR_PASTEL_BG = "#E2E8F0"; // Slate-200 (Pastel grey/blue style)
const URL_REGEX = /(https?:\/\/[^\s]+)/;

const LinkPreview = ({
  url,
  isMe,
  onHeightChange,
}: {
  url: string;
  isMe: boolean;
  onHeightChange?: () => void;
}) => {
  const [preview, setPreview] = useState<{
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // localhost나 내부 IP는 외부 API에서 접근 불가하므로 스킵
    const isLocalUrl =
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("192.168.") ||
      url.includes("10.0.") ||
      url.includes("172.16.");

    if (isLocalUrl) {
      setLoading(false);
      return;
    }

    const fetchMeta = async () => {
      try {
        const res = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(url)}`,
        );
        const data = await res.json();
        if (isMounted && data.status === "success") {
          setPreview({
            title: data.data.title,
            description: data.data.description,
            image: data.data.image?.url,
            siteName: data.data.publisher,
          });
        }
      } catch (e) {
        // 메타데이터 로드 실패 시 조용히 무시
      } finally {
        if (isMounted) {
          setLoading(false);
          // Metadata loaded, height will change
          setTimeout(() => onHeightChange?.(), 50);
        }
      }
    };
    fetchMeta();
    return () => {
      isMounted = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 w-full max-w-[260px] h-20 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 block w-full max-w-[260px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:border-[#ee2b8c] transition-all active:scale-[0.98] ${isMe ? "ml-auto" : "mr-auto"
        }`}
    >
      {preview.image && (
        <div className="aspect-[1.91/1] w-full overflow-hidden border-b border-gray-50">
          <img
            src={preview.image}
            alt="preview"
            className="w-full h-full object-cover"
            onLoad={() => {
              // Image content loaded, height might change again
              onHeightChange?.();
            }}
          />
        </div>
      )}
      <div className="p-3 space-y-1">
        {preview.siteName && (
          <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
            {preview.siteName}
          </div>
        )}
        <h4 className="text-xs font-bold text-gray-800 line-clamp-1 leading-tight">
          {preview.title || url}
        </h4>
        {preview.description && (
          <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
};

const PAGE_SIZE = 50;

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const chatRoomId = searchParams.get("chatRoomId");
  const router = useRouter();
  const { fetchWithAuth } = useApi();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [roomName, setRoomName] = useState("플랜톡");
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [loading, setLoading] = useState(true);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  const isFullRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const currentPageRef = useRef(1);

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatDateHeader = (fullDate: string) => {
    const [y, m, d] = fullDate.split("-");
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    // requestAnimationFrame or setTimeout ensures we scroll AFTER the DOM update
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const convertHistoryToMessage = useCallback(
    (item: ChatHistoryItem): Message => {
      const myUserId = myUserIdRef.current;
      return {
        id: String(item.id),
        senderId: item.planUserId,
        senderName: item.planUserName,
        senderImage: item.planUserProfileImageUrl,
        messageType: item.messageType,
        text: item.text,
        schedule: item.schedule,
        timestamp: formatTimestamp(item.createDate),
        fullDate: getFullDate(item.createDate),
        isMe: item.planUserId === myUserId,
      };
    },
    [],
  );

  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMoreRef.current || isFullRef.current) return;

    const nextPage = currentPageRef.current + 1;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    const scrollDiv = scrollRef.current;
    const prevScrollHeight = scrollDiv?.scrollHeight ?? 0;

    try {
      const res = await fetchWithAuth(
        `/plan/chat/${chatRoomId}?page=${nextPage}&count=${PAGE_SIZE}&sort=DESC`,
      );
      if (res.status === 401) {
        clearToken();
        setReturnPathAfterLogin(`/chat/${roomId}`);
        setShowLoginModal(true);
        return;
      }

      const json = await res.json();
      if (json.result && json.data?.list) {
        const list: ChatHistoryItem[] = json.data.list;

        if (list.length < PAGE_SIZE) {
          isFullRef.current = true;
        }

        const newMessages = list.map(convertHistoryToMessage);
        setMessages((prev) => [...newMessages, ...prev]);
        currentPageRef.current = nextPage;

        requestAnimationFrame(() => {
          if (scrollDiv) {
            scrollDiv.scrollTop = scrollDiv.scrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [chatRoomId, roomId, fetchWithAuth, convertHistoryToMessage]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (vv) {
        setViewportHeight(`${vv.height}px`);
        const wrapper = document.getElementById("chat-viewport-wrapper");
        if (wrapper) {
          wrapper.style.transform = `translateY(${vv.offsetTop}px)`;
        }
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
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
    if (initialLoadDoneRef.current) return;

    const token = getToken();
    if (!token) {
      setReturnPathAfterLogin(`/chat/${roomId}`);
      setShowLoginModal(true);
      setLoading(false);
      return;
    }

    myUserIdRef.current = getPlanUserIdFromToken();
    initialLoadDoneRef.current = true;

    const fetchRoomInfo = async () => {
      setLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const res = await fetchWithAuth(`/plan/room/${roomId}`);
        if (res.status === 401) {
          clearToken();
          setReturnPathAfterLogin(`/chat/${roomId}`);
          setShowLoginModal(true);
          setLoading(false);
          return;
        }
        const json: RoomResponse = await res.json();
        if (json.result && json.data) {
          setRoomName(`${json.data.name}님의 웨딩 플랜`);
          setMembers(json.data.members ?? []);
        }

        // Load initial chat history
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        try {
          const chatRes = await fetchWithAuth(
            `/plan/chat/${chatRoomId}?page=1&count=${PAGE_SIZE}&sort=DESC`,
          );
          if (chatRes.status === 401) {
            clearToken();
            setReturnPathAfterLogin(`/chat/${roomId}`);
            setShowLoginModal(true);
            return;
          }
          const chatJson = await chatRes.json();
          if (chatJson.result && chatJson.data?.list) {
            const list: ChatHistoryItem[] = chatJson.data.list;
            if (list.length < PAGE_SIZE) {
              isFullRef.current = true;
            }
            const newMessages = list.map(
              (item: ChatHistoryItem): Message => ({
                id: String(item.id),
                senderId: item.planUserId,
                senderName: item.planUserName,
                senderImage: item.planUserProfileImageUrl,
                messageType: item.messageType,
                text: item.text,
                schedule: item.schedule,
                timestamp: formatTimestamp(item.createDate),
                fullDate: getFullDate(item.createDate),
                isMe: item.planUserId === myUserIdRef.current,
              }),
            );
            setMessages(newMessages.reverse());
            currentPageRef.current = 1;

            // 1. 즉시 최하단으로 이동 시도
            requestAnimationFrame(() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            });

            // 2. 메시지 렌더링(이미지 등) 시간을 고려하여 약간의 지연 후 다시 한 번 시도
            scrollToBottom("instant");
          }
        } finally {
          isLoadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      } catch (err) {
        console.error("Failed to fetch room info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoomInfo();
  }, [roomId, chatRoomId, fetchWithAuth]);

  useEffect(() => {
    const token = getToken();
    if (!token || !chatRoomId) return;

    const baseUrl = getApiBaseUrl();
    const socketUrl = baseUrl.replace(/\/+$/, "");

    // 1. 기존 소켓이 있다면 확실히 정리 (Strict Mode 중복 방지)
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    const socket = io(`${socketUrl}/chat`, {
      transports: ["websocket"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true, // 새로운 연결을 강제함
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected, joining chatRoom:", chatRoomId);
      socket.emit("joinRoom", {
        room: Number(chatRoomId),
        userId: myUserIdRef.current,
      });
    });

    socket.on("message", (payload: SocketMessagePayload) => {
      // 1. 고유 ID 생성 (서버 ID가 없을 경우 대비)
      const tempId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const newMsg: Message = {
        id: tempId,
        senderId: payload.senderId,
        senderName: payload.senderName,
        senderImage: payload.senderProfileImageUrl,
        messageType: payload.message.messageType,
        text: payload.message.text,
        schedule: payload.message.schedule,
        timestamp: formatTimestamp(new Date().toISOString()),
        fullDate: getFullDate(new Date().toISOString()),
        isMe: payload.senderId === myUserIdRef.current,
      };

      setMessages((prev) => {
        // 이미 동일한 내용과 작성자의 메시지가 아주 최근(2초 이내)에 추가되었는지 확인 (중복 방지)
        const isDuplicate = prev.some((m) => {
          const isSameContent =
            m.senderId === newMsg.senderId &&
            m.text === newMsg.text &&
            m.messageType === newMsg.messageType;

          if (!isSameContent) return false;

          // ID가 'msg-'로 시작하는 경우(최근 소켓 메시지)에만 시간차 체크
          const idStr = String(m.id);
          if (idStr.startsWith("msg-")) {
            const timestampPart = idStr.split("-")[1];
            const ts = parseInt(timestampPart || "0");
            return Math.abs(Date.now() - ts) < 2000;
          }

          // 일반 ID(과거 기록)인 경우 내용이 같으면 중복으로 간주 (방금 보낸 메시지가 서버에서 기록으로 먼저 조회된 경우 등)
          return true;
        });

        if (isDuplicate && !newMsg.schedule) {
          return prev;
        }
        return [...prev, newMsg];
      });
      scrollToBottom();
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("error", (errorMessage: string) => {
      console.error("Socket error:", errorMessage);
      alert(errorMessage);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    // 브라우저 닫기/새로고침 시 leaveRoom 전송
    const handleBeforeUnload = () => {
      if (socket.connected && chatRoomId) {
        socket.emit("leaveRoom", chatRoomId);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // leaveRoom 이벤트 전송
      if (socket.connected && chatRoomId) {
        socket.emit("leaveRoom", chatRoomId);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [chatRoomId]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || !socketRef.current || !chatRoomId) return;

    socketRef.current.emit("message", {
      room: Number(chatRoomId),
      message: inputValue.trim(),
      messageType: "text",
    });

    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, chatRoomId]);

  const handleCloseLoginModal = () => {
    setShowLoginModal(false);
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#fcfbfc] overflow-hidden">
        <div className="h-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col">
          <header className="flex items-center justify-between px-4 h-16 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full skeleton-shimmer" />
              <div className="space-y-2">
                <div className="w-32 h-4 rounded skeleton-shimmer" />
                <div className="w-20 h-2 rounded skeleton-shimmer" />
              </div>
            </div>
            <div className="w-8 h-8 rounded-full skeleton-shimmer" />
          </header>
          <div className="flex-1 px-4 py-8 space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"} items-end gap-2`}
              >
                {i % 2 !== 0 && (
                  <div className="w-8 h-8 rounded-full skeleton-shimmer" />
                )}
                <div
                  className={`w-48 h-12 rounded-2xl skeleton-shimmer ${i % 2 === 0 ? "rounded-tr-none" : "rounded-tl-none"}`}
                />
              </div>
            ))}
          </div>
          <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
            <div className="h-11 rounded-2xl skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        id="chat-viewport-wrapper"
        className="fixed inset-0 bg-[#fcfbfc] overflow-hidden"
        style={{
          height: viewportHeight,
          fontFamily: "var(--font-kakao), sans-serif",
          transition: "transform 0.3s ease-out, height 0.3s ease-out",
        }}
      >
        <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />

        <div className="h-full max-w-md mx-auto bg-white shadow-2xl relative overflow-hidden flex flex-col z-10">
          <header className="flex items-center justify-between px-4 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex-shrink-0 z-50">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/plan-list")}
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

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide space-y-6"
            onScroll={() => {
              const scrollDiv = scrollRef.current;
              if (!scrollDiv || isLoadingMoreRef.current || isFullRef.current)
                return;
              if (scrollDiv.scrollTop <= 50) {
                loadMoreHistory();
              }
            }}
            onClick={() => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }}
          >
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <div className="w-6 h-6 border-2 border-[#ee2b8c] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* History loading or initial messages would start here */}

            {messages.map((msg, idx) => {
              const { isMe } = msg;

              // Check if date has changed from previous message
              const showDateHeader =
                idx === 0 || messages[idx - 1].fullDate !== msg.fullDate;

              const showAvatar =
                !isMe &&
                (idx === 0 ||
                  messages[idx - 1].senderId !== msg.senderId ||
                  showDateHeader);

              return (
                <div key={msg.id} className="space-y-6">
                  {showDateHeader && (
                    <div className="flex justify-center my-8 first:mt-4">
                      <span className="text-[10px] font-bold text-gray-400 bg-stone-100/80 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                        {formatDateHeader(msg.fullDate)}
                      </span>
                    </div>
                  )}

                  <div
                    className={`flex ${isMe ? "justify-end" : "justify-start"
                      } items-end gap-2`}
                  >
                    {!isMe && (
                      <div className="w-10 h-10 rounded-full flex-shrink-0 mb-1 flex items-center justify-center bg-[#E2E8F0] shadow-sm relative overflow-hidden">
                        {msg.senderImage ? (
                          <img
                            src={msg.senderImage}
                            alt={msg.senderName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                          />
                        )}
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"
                        } max-w-[70%]`}
                    >
                      {!isMe && showAvatar && (
                        <span className="text-[10px] font-bold text-gray-400 mb-1 ml-1">
                          {msg.senderName}
                        </span>
                      )}

                      {msg.messageType === "text" ? (
                        <>
                          <div
                            className={`px-4 py-2.5 rounded-[20px] text-sm font-medium shadow-sm leading-relaxed break-all whitespace-pre-wrap ${isMe
                              ? "bg-[#ee2b8c] text-white rounded-tr-none"
                              : "bg-white text-stone-800 border border-gray-100 rounded-tl-none"
                              }`}
                            style={{
                              fontFamily: "var(--font-tmoney), sans-serif",
                            }}
                          >
                            {msg.text}
                          </div>
                          {msg.text && URL_REGEX.test(msg.text) && (
                            <LinkPreview
                              url={msg.text.match(URL_REGEX)![0]}
                              isMe={isMe}
                              onHeightChange={() => scrollToBottom("smooth")}
                            />
                          )}
                        </>
                      ) : msg.messageType === "schedule" && msg.schedule ? (
                        <div className="bg-white border border-orange-300 rounded-xl p-4 min-w-[200px] shadow-sm">
                          <div className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded font-bold inline-block mb-2">
                            📅 {msg.schedule.categoryName} |{" "}
                            {msg.schedule.status}
                          </div>
                          <div className="text-base font-bold text-stone-900">
                            {msg.schedule.title}
                          </div>
                          <div className="text-sm font-extrabold text-red-600 border-t border-dashed border-gray-200 mt-2 pt-2">
                            {Number(msg.schedule.amount).toLocaleString()}원
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-2.5 rounded-[20px] text-sm bg-gray-100 text-gray-400">
                          삭제된 일정입니다.
                        </div>
                      )}
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
                </div>
              );
            })}
          </div>

          <div className="px-4 py-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <button className="flex items-center justify-center shrink-0 w-11 h-11 bg-gray-50 text-stone-400 rounded-2xl hover:bg-gray-100 transition-colors">
                <ImageIcon className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0 relative flex items-center">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (e.shiftKey) return; // Shift + Enter: 줄바꿈

                      // 한글 입력 중(IME composition)에는 엔터로 메시지 발송 방지
                      if (e.nativeEvent.isComposing) return;

                      const isMobile = /iPhone|iPad|iPod|Android/i.test(
                        navigator.userAgent,
                      );

                      if (!isMobile) {
                        e.preventDefault();
                        handleSend();
                      }
                    }
                  }}
                  onFocus={() => {
                    setTimeout(() => {
                      if (scrollRef.current) {
                        scrollRef.current.scrollTop =
                          scrollRef.current.scrollHeight;
                      }
                    }, 400);
                  }}
                  placeholder="메시지를 입력하세요..."
                  className="w-full bg-gray-50 text-stone-800 text-base font-medium rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#ee2b8c33] transition-all resize-none overflow-y-auto no-scrollbar min-h-[44px]"
                  style={{
                    maxHeight: "120px",
                    fontFamily: "var(--font-kakao), sans-serif",
                  }}
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-300 hover:text-stone-500">
                  <Smile className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={handleSend}
                onMouseDown={(e) => {
                  if (inputValue.trim()) {
                    e.preventDefault();
                  }
                }}
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
        title="세션이 만료되었습니다. 다시 로그인해 주세요."
      />
    </>
  );
}
