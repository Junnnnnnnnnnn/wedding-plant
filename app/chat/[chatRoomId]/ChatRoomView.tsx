"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Image as ImageIcon,
  Smile,
  MoreVertical,
  CheckCheck,
  User,
} from "lucide-react";
import { useApi } from "../../contexts/ApiContext";
import { useNotification } from "../../contexts/NotificationContext";
import CoupleChatBadge from "../../components/CoupleChatBadge";
import CustomAlertModal from "../../components/CustomAlertModal";
import {
  getToken,
  setReturnPathAfterLogin,
  clearToken,
  getPlanUserIdFromToken,
  getApiBaseUrl,
} from "@/lib/api";
import LoginRequiredModal from "../../components/LoginRequiredModal";
import ChatRoomNameEditModal from "../../components/ChatRoomNameEditModal";

interface ScheduleData {
  id: number;
  categoryName: string;
  title: string;
  amount: number;
  startDate: string | null;
  status: string;
  location: string | null;
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
  unreadCount: number;
}

interface RoomMember {
  planUserId: string;
  name: string;
  image: string | null;
  permission: string;
}

interface ChatInfo {
  id: number;
  name: string;
  /** 신랑·신부 방. 방장과 배우자 둘만 있는 방이다 */
  isCouple?: boolean;
  memberList: RoomMember[];
}

interface ChatInfoResponse {
  data?: ChatInfo;
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
  unreadCount?: number;
}

interface SocketMessagePayload {
  // Nested structure (some versions)
  senderId?: string;
  senderName?: string;
  senderProfileImageUrl?: string | null;
  message?: {
    messageType: "text" | "schedule";
    text?: string;
    schedule?: ScheduleData | null;
  };
  // Flat structure (latest version/API matching)
  id?: string | number;
  planUserId?: string;
  planUserName?: string;
  planUserProfileImageUrl?: string | null;
  messageType?: "text" | "schedule";
  text?: string;
  schedule?: ScheduleData | null;
  unreadCount?: number;
  createDate?: string;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/;

type LinkPreviewMeta = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
} | null;

/**
 * URL별 프리뷰 결과 캐시.
 * 같은 링크가 여러 메시지에 있거나 컴포넌트가 다시 마운트돼도
 * 외부 API(api.microlink.io)를 반복 호출하지 않는다.
 */
const linkPreviewCache = new Map<string, LinkPreviewMeta>();

function LinkPreview({
  url,
  isMe,
  onHeightChange,
}: {
  url: string;
  isMe: boolean;
  onHeightChange?: () => void;
}) {
  const cached = linkPreviewCache.get(url);
  const [preview, setPreview] = useState<LinkPreviewMeta>(cached ?? null);
  const [loading, setLoading] = useState(!linkPreviewCache.has(url));

  // 부모가 인라인 화살표로 넘기는 콜백이라 렌더마다 참조가 바뀐다.
  // 의존성 배열에 그대로 넣으면 키 입력 한 번마다 프리뷰를 다시 불러온다.
  const onHeightChangeRef = useRef(onHeightChange);
  useEffect(() => {
    onHeightChangeRef.current = onHeightChange;
  });

  useEffect(() => {
    let isMounted = true;

    // 이미 받아둔 URL이면 다시 요청하지 않는다
    if (linkPreviewCache.has(url)) {
      setPreview(linkPreviewCache.get(url) ?? null);
      setLoading(false);
      return undefined;
    }

    // localhost나 내부 IP는 외부 API에서 접근 불가하므로 스킵
    const isLocalUrl =
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("192.168.") ||
      url.includes("10.0.") ||
      url.includes("172.16.");

    if (isLocalUrl) {
      linkPreviewCache.set(url, null);
      setLoading(false);
      return undefined;
    }

    const fetchMeta = async () => {
      try {
        const res = await fetch(
          `https://api.microlink.io?url=${encodeURIComponent(url)}`,
        );
        const data = await res.json();
        if (data.status === "success") {
          const meta: LinkPreviewMeta = {
            title: data.data.title,
            description: data.data.description,
            image: data.data.image?.url,
            siteName: data.data.publisher,
          };
          linkPreviewCache.set(url, meta);
          if (isMounted) setPreview(meta);
        } else {
          linkPreviewCache.set(url, null);
        }
      } catch (e) {
        // 메타데이터 로드 실패 시 조용히 무시 (재시도 폭주를 막기 위해 캐시)
        linkPreviewCache.set(url, null);
      } finally {
        if (isMounted) {
          setLoading(false);
          // Metadata loaded, height will change
          setTimeout(() => onHeightChangeRef.current?.(), 50);
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
      className={`mt-2 block w-full max-w-[260px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:border-[#ee2b8c] transition-all active:scale-[0.98] ${
        isMe ? "ml-auto" : "mr-auto"
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
}

const PAGE_SIZE = 50;

const getFullDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDateHeader = (fullDate: string) => {
  const [y, m, d] = fullDate.split("-");
  return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
};

const ChatMessage = React.memo(
  ({
    msg,
    isMe,
    showDateHeader,
    showAvatar,
    scrollToBottom,
    onScheduleClick,
  }: {
    msg: Message;
    isMe: boolean;
    showDateHeader: boolean;
    showAvatar: boolean;
    scrollToBottom: (behavior?: ScrollBehavior) => void;
    onScheduleClick?: (scheduleId: number) => void;
  }) => {
    return (
      <div className="space-y-6">
        {showDateHeader && (
          <div className="flex justify-center my-8 first:mt-4">
            <span className="text-[10px] font-bold text-gray-400 bg-stone-100/80 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              {formatDateHeader(msg.fullDate)}
            </span>
          </div>
        )}

        <div
          className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}
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
                <User className="w-6 h-6 text-white" fill="currentColor" />
              )}
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

            {msg.messageType === "text" ? (
              <>
                <div
                  className={`px-4 py-2.5 rounded-[20px] text-sm font-medium shadow-sm leading-relaxed break-all whitespace-pre-wrap ${
                    isMe
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
                    onHeightChange={() => scrollToBottom()}
                  />
                )}
              </>
            ) : msg.messageType === "schedule" && msg.schedule ? (
              <div
                className="relative min-w-[220px] max-w-[280px] rounded-2xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100"
                style={{
                  boxShadow:
                    "inset 0 0 1px rgba(255, 255, 255, 1), 0 4px 12px rgba(0, 0, 0, 0.08)",
                }}
              >
                {/* 제목 헤더 */}
                <div className="px-4 pt-3 pb-2 bg-gradient-to-r from-[#ee2b8c] to-[#ff6b9d]">
                  <span className="text-[13px] font-bold text-white">
                    {msg.schedule.title}
                  </span>
                </div>

                {/* 콘텐츠 */}
                <div className="relative p-4 pt-3">
                  {/* 카테고리 */}
                  <div className="text-[11px] font-medium text-gray-500 mb-2">
                    {msg.schedule.categoryName}
                  </div>

                  {/* 날짜 */}
                  {msg.schedule.startDate && (
                    <div className="text-xs text-gray-500 mb-1">
                      {new Date(msg.schedule.startDate).toLocaleDateString(
                        "ko-KR",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </div>
                  )}

                  {/* 장소 */}
                  {msg.schedule.location && (
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <span>📍</span>
                      <span className="truncate">{msg.schedule.location}</span>
                    </div>
                  )}

                  {/* 금액 */}
                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-200/60">
                    <span className="text-[11px] text-gray-400 font-medium">
                      비용
                    </span>
                    <span className="text-base font-extrabold text-[#ee2b8c]">
                      {Number(msg.schedule.amount) > 0
                        ? `${Number(msg.schedule.amount).toLocaleString()}만원`
                        : "미정"}
                    </span>
                  </div>

                  {/* 바로가기 버튼 */}
                  {msg.schedule.id && (
                    <button
                      type="button"
                      onClick={() => onScheduleClick?.(msg.schedule!.id)}
                      className="w-full mt-3 py-2 flex items-center justify-center gap-1 rounded-lg bg-white/80 border border-gray-200 text-xs font-bold text-gray-600 hover:bg-white active:scale-[0.98] transition-all"
                    >
                      <span>상세보기</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-[20px] text-sm bg-gray-100 text-gray-400">
                삭제된 일정입니다.
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5 mb-1 flex-shrink-0">
            {isMe && msg.unreadCount === 0 && (
              <CheckCheck className="w-3.5 h-3.5 text-[#ee2b8c]" />
            )}
            <span className="text-[9px] font-bold text-gray-300">
              {msg.timestamp}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

ChatMessage.displayName = "ChatMessage";

// Utility functions moved outside component to prevent recreation on every render
const formatTimestamp = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Memoized List Component to prevent re-rendering when typing
const ChatMessagesList = React.memo(
  ({
    messages,
    isLoadingMore,
    scrollToBottom,
    onScheduleClick,
  }: {
    messages: Message[];
    isLoadingMore: boolean;
    scrollToBottom: (behavior?: ScrollBehavior) => void;
    onScheduleClick?: (scheduleId: number) => void;
  }) => {
    return (
      <>
        {isLoadingMore && (
          <div className="flex justify-center py-2 h-10 flex-shrink-0">
            <div className="w-6 h-6 border-2 border-[#ee2b8c] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {messages.map((msg, idx) => {
          const { isMe } = msg;
          const showDateHeader =
            idx === 0 || messages[idx - 1].fullDate !== msg.fullDate;
          const showAvatar =
            !isMe &&
            (idx === 0 ||
              messages[idx - 1].senderId !== msg.senderId ||
              showDateHeader);

          return (
            <ChatMessage
              key={`${msg.id}-${msg.unreadCount}`}
              msg={msg}
              isMe={isMe}
              showDateHeader={showDateHeader}
              showAvatar={showAvatar}
              scrollToBottom={scrollToBottom}
              onScheduleClick={onScheduleClick}
            />
          );
        })}
      </>
    );
  },
);

ChatMessagesList.displayName = "ChatMessagesList";

export type ChatRoomViewVariant = "standalone" | "pane";

interface ChatRoomViewProps {
  chatRoomId: string;
  /**
   * standalone = /chat/[id] 라우트. 화면 전체를 차지하고, 모바일 키보드가
   *   올라올 때 visualViewport 높이를 직접 계산해 입력창을 띄운다.
   * pane = 넓은 화면에서 목록 옆에 끼워 넣는 형태. 높이를 바깥(AppShell)이
   *   정하므로 fixed/dvh 계산을 하면 레이아웃이 어긋난다.
   */
  variant?: ChatRoomViewVariant;
}

export default function ChatRoomView({
  chatRoomId,
  variant = "standalone",
}: ChatRoomViewProps) {
  const isPane = variant === "pane";
  const router = useRouter();
  const { fetchWithAuth } = useApi();
  const { subscribeToChatRooms, resetUnreadCount, setActiveRoomId } =
    useNotification();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [roomName, setRoomName] = useState("플랜톡");
  /** 신랑·신부 방이면 머리글에 표식을 단다 */
  const [isCoupleRoom, setIsCoupleRoom] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    message: string;
    type: "warning" | "error" | "info" | "success";
  }>({
    isOpen: false,
    message: "",
    type: "warning",
  });
  const [viewportHeight, setViewportHeight] = useState("100dvh");
  const [loading, setLoading] = useState(true);
  const [showNameEditModal, setShowNameEditModal] = useState(false);

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // 초기 로드가 실패하면 빈 방으로 보였다. 오류를 화면에 드러내고 재시도를 준다.
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [, forceUpdate] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const myUserIdRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  /** 진행 중인 히스토리 요청. 방을 나가거나 새 요청이 시작되면 취소한다 */
  const historyAbortRef = useRef<AbortController | null>(null);
  const isFullRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const currentPageRef = useRef(1);
  const membersRef = useRef<RoomMember[]>([]);

  const scrollToBottom = useCallback(() => {
    // requestAnimationFrame or setTimeout ensures we scroll AFTER the DOM update
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  /**
   * 사용자가 이미 하단 근처를 보고 있을 때만 맨 아래로 내린다.
   *
   * 링크 프리뷰가 로드될 때마다 무조건 scrollToBottom 을 부르면,
   * 위로 스크롤해 과거 메시지를 읽는 중에 화면이 계속 아래로 튕긴다.
   */
  useEffect(
    () => () => {
      historyAbortRef.current?.abort();
    },
    [],
  );

  const scrollToBottomIfNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 150) return;
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
        unreadCount: item.unreadCount ?? 0,
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
    const prevScrollTop = scrollDiv?.scrollTop ?? 0;

    try {
      historyAbortRef.current?.abort();
      const controller = new AbortController();
      historyAbortRef.current = controller;
      const res = await fetchWithAuth(
        `/plan/chat/${chatRoomId}?page=${nextPage}&count=${PAGE_SIZE}&sort=DESC`,
        { skipAuthHandling: true, signal: controller.signal },
      );
      if (res.status === 401) {
        clearToken();
        setReturnPathAfterLogin(`/chat/${chatRoomId}`);
        setShowLoginModal(true);
        return;
      }

      const json = await res.json();
      if (json.result && json.data?.list) {
        const { list } = json.data;

        if (list.length < PAGE_SIZE) {
          isFullRef.current = true;
        }

        const newMessages: Message[] = list.map(convertHistoryToMessage);
        // 오프셋 페이지네이션 + 실시간 삽입 조합이라, 불러오는 사이에 새
        // 메시지가 오면 같은 메시지가 다시 앞에 붙어 두 번 표시됐다.
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const deduped = newMessages.filter((m) => !existing.has(m.id));
          return deduped.length ? [...deduped, ...prev] : prev;
        });
        currentPageRef.current = nextPage;

        requestAnimationFrame(() => {
          if (scrollDiv) {
            // prevScrollTop 을 더하지 않으면 읽던 위치가 최대 그만큼 어긋난다
            scrollDiv.scrollTop =
              scrollDiv.scrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      }
    } catch (err) {
      // 새 요청/언마운트로 취소된 것은 오류가 아니다
      if ((err as { name?: string })?.name === "AbortError") return;
      console.error("Failed to load chat history:", err);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [chatRoomId, fetchWithAuth, convertHistoryToMessage]);

  const handleUpdateRoomName = async (newName: string) => {
    try {
      const res = await fetchWithAuth(`/plan/chat/name/${chatRoomId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName }),
        skipAuthHandling: true,
      });

      if (res.status === 401) {
        // 다른 401 처리와 달리 복귀 경로만 빠져 있었다. 재로그인 후
        // 이 채팅방으로 돌아오지 못했다.
        clearToken();
        setReturnPathAfterLogin(`/chat/${chatRoomId}`);
        setShowLoginModal(true);
        return;
      }

      if (res.ok) {
        setRoomName(newName);
        setAlertConfig({
          isOpen: true,
          message: "채팅방 이름이 성공적으로 변경되었습니다.",
          type: "success",
        });
      } else {
        throw new Error("Failed to update name");
      }
    } catch (err) {
      console.error("Failed to update chat room name:", err);
      setAlertConfig({
        isOpen: true,
        message: "채팅방 이름 변경에 실패했습니다. 다시 시도해 주세요.",
        type: "error",
      });
      throw err;
    }
  };

  useEffect(() => {
    // pane 모드에서는 높이를 바깥이 정한다. 여기서 뷰포트 높이를 잡으면
    // 목록 옆에 끼운 채팅이 화면 밖으로 밀려난다.
    if (isPane) return;
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
  }, [isPane]);

  useEffect(() => {
    if (initialLoadDoneRef.current) return;

    const token = getToken();
    if (!token) {
      setReturnPathAfterLogin(`/chat/${chatRoomId}`);
      setShowLoginModal(true);
      setLoading(false);
      return;
    }

    myUserIdRef.current = getPlanUserIdFromToken();
    initialLoadDoneRef.current = true;

    const fetchChatInfo = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const res = await fetchWithAuth(`/plan/chat/info/${chatRoomId}`, {
          skipAuthHandling: true,
        });
        if (res.status === 401) {
          clearToken();
          setReturnPathAfterLogin(`/chat/${chatRoomId}`);
          setShowLoginModal(true);
          setLoading(false);
          return;
        }
        // res.ok 를 안 보고 바로 json() 을 파싱했다. 403/500 이면 파싱이
        // 실패하거나 result 가 false 라 조용히 넘어가고, 사용자에게는
        // 이름도 메시지도 없는 빈 채팅방이 보였다.
        if (!res.ok) throw new Error(`chat info failed: ${res.status}`);
        const json: ChatInfoResponse = await res.json();
        if (json.result && json.data) {
          setRoomName(json.data.name);
          setIsCoupleRoom(json.data.isCouple === true);
          const memberList = json.data.memberList ?? [];
          setMembers(memberList);
          membersRef.current = memberList;
        }

        // Load initial chat history
        isLoadingMoreRef.current = true;
        setIsLoadingMore(true);
        try {
          const chatRes = await fetchWithAuth(
            `/plan/chat/${chatRoomId}?page=1&count=${PAGE_SIZE}&sort=DESC`,
            { skipAuthHandling: true },
          );
          if (chatRes.status === 401) {
            clearToken();
            setReturnPathAfterLogin(`/chat/${chatRoomId}`);
            setShowLoginModal(true);
            return;
          }
          if (!chatRes.ok)
            throw new Error(`chat history failed: ${chatRes.status}`);
          const chatJson = await chatRes.json();
          if (chatJson.result && chatJson.data?.list) {
            const { list } = chatJson.data;
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
                unreadCount: item.unreadCount ?? 0,
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
            scrollToBottom();
          }
        } finally {
          isLoadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      } catch (err) {
        console.error("Failed to load chat room:", err);
        // 재시도할 수 있도록 가드를 풀어 준다
        initialLoadDoneRef.current = false;
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchChatInfo();
  }, [chatRoomId, fetchWithAuth, scrollToBottom, reloadKey]);

  // SSE 푸시 알림 연결
  useEffect(() => {
    if (!chatRoomId) return;
    subscribeToChatRooms([Number(chatRoomId)]);
    resetUnreadCount();
  }, [chatRoomId, subscribeToChatRooms, resetUnreadCount]);

  // 보고 있는 방을 알림 컨텍스트에 알린다.
  // pane 으로 열리면 경로가 /plan-list 라 컨텍스트가 스스로 알 수 없다.
  useEffect(() => {
    if (!chatRoomId) return undefined;
    setActiveRoomId(chatRoomId);
    return () => setActiveRoomId(null);
  }, [chatRoomId, setActiveRoomId]);

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
      socket.emit("joinRoom", {
        room: Number(chatRoomId),
        userId: myUserIdRef.current,
      });
    });

    socket.on("roomList", (data: unknown) => {
      const roomArray = Array.isArray(data) ? data : [];
      const currentRoom = roomArray.find(
        (room: { name?: string; count?: number }) =>
          String(room.name) === String(chatRoomId),
      );

      if (currentRoom) {
        const totalMembers = membersRef.current.length;
        const userCount = currentRoom.count ?? 0;
        if (totalMembers > 0 && userCount >= totalMembers) {
          setMessages((prev) =>
            prev.map((msg) => ({ ...msg, unreadCount: 0 })),
          );
          forceUpdate((n) => n + 1);
        }
      }
    });

    socket.on("message", (payload: SocketMessagePayload) => {
      // 데이터 구조에 따른 필드 추출 (Flat vs Nested 대응)
      const senderId = payload.planUserId || payload.senderId || "";
      const senderName =
        payload.planUserName || payload.senderName || "알 수 없음";
      const senderImage =
        payload.planUserProfileImageUrl || payload.senderProfileImageUrl;
      const messageType =
        payload.messageType || payload.message?.messageType || "text";
      const text = payload.text || payload.message?.text;
      const schedule = payload.schedule || payload.message?.schedule;
      const unreadCount = payload.unreadCount ?? 0;
      const timestamp = payload.createDate
        ? formatTimestamp(payload.createDate)
        : formatTimestamp(new Date().toISOString());
      const fullDate = payload.createDate
        ? getFullDate(payload.createDate)
        : getFullDate(new Date().toISOString());

      // 1. 고유 ID 생성 (서버 ID가 있으면 우선 사용)
      const msgId = payload.id
        ? String(payload.id)
        : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const newMsg: Message = {
        id: msgId,
        senderId,
        senderName,
        senderImage,
        messageType,
        text,
        schedule,
        timestamp,
        fullDate,
        isMe: senderId === myUserIdRef.current,
        unreadCount,
      };

      setMessages((prev) => {
        const isDuplicate = prev.some(
          (m) => String(m.id) === String(newMsg.id),
        );
        if (isDuplicate) {
          return prev;
        }
        return [...prev, newMsg];
      });
      // 내가 보낸 메시지가 아니어도 무조건 내리면, 위를 읽는 중에
      // 화면이 아래로 끌려간다. 하단 근처일 때만 내린다.
      scrollToBottomIfNearBottom();
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("error", (payload: unknown) => {
      console.error("Socket error:", payload);
      // string 으로 타이핑돼 있었지만 서버는 객체도 보낸다. 객체를 그대로
      // 메시지에 넣으면 "Objects are not valid as a React child" 로 화면
      // 전체가 크래시했다. 문자열이 아닌 건 일반 안내로 대체한다.
      const raw =
        typeof payload === "string"
          ? payload
          : (payload as { message?: unknown } | null)?.message;
      const message =
        typeof raw === "string" && raw.trim()
          ? raw.trim()
          : "채팅 연결에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      setAlertConfig({
        isOpen: true,
        message,
        type: "error",
      });
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
  }, [chatRoomId, scrollToBottom, scrollToBottomIfNearBottom]);

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
      <div
        className={
          isPane
            ? "h-full w-full bg-[#fcfbfc] overflow-hidden"
            : "fixed inset-0 bg-[#fcfbfc] overflow-hidden"
        }
      >
        <div
          className={`h-full bg-white relative overflow-hidden flex flex-col ${
            isPane ? "w-full" : "max-w-md mx-auto shadow-2xl"
          }`}
        >
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
        id={isPane ? undefined : "chat-viewport-wrapper"}
        className={
          isPane
            ? "h-full w-full bg-[#fcfbfc] overflow-hidden"
            : "fixed inset-0 bg-[#fcfbfc] overflow-hidden"
        }
        style={
          isPane
            ? { fontFamily: "var(--font-kakao), sans-serif" }
            : {
                height: viewportHeight,
                fontFamily: "var(--font-kakao), sans-serif",
                transition: "transform 0.3s ease-out, height 0.3s ease-out",
              }
        }
      >
        {!isPane && (
          <div className="hidden lg:block absolute inset-0 bg-gray-100 z-0" />
        )}

        <div
          className={`h-full bg-white relative overflow-hidden flex flex-col z-10 ${
            isPane ? "w-full" : "max-w-md mx-auto shadow-2xl"
          }`}
        >
          <header className="flex items-center justify-between px-4 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex-shrink-0 z-50">
            <div className="flex items-center gap-3">
              {!isPane && (
                <button
                  type="button"
                  onClick={() => router.push("/plan-list")}
                  className="p-1 -ml-1 text-stone-600"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-xl font-normal text-[#1b0d14] max-w-[260px] truncate leading-tight tracking-tight">
                  <span className="truncate">{roomName}</span>
                  {isCoupleRoom && <CoupleChatBadge size="sm" />}
                </h1>
                <p className="text-[10px] text-stone-400 font-medium mt-1 truncate max-w-[200px]">
                  {members.length > 0
                    ? members.map((m) => m.name).join(", ")
                    : "대화 중인 멤버"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNameEditModal(true)}
              className="p-2 text-stone-400 hover:text-[#ee2b8c] transition-colors"
            >
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
            {loadError && (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <p className="text-stone-500 text-sm font-medium">
                  대화를 불러오지 못했습니다.
                  <br />
                  네트워크 상태를 확인한 뒤 다시 시도해 주세요.
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="h-11 px-6 rounded-full bg-[#ee2b8c] text-white text-sm font-bold shadow-lg shadow-[#ee2b8c33] active:scale-95 transition-transform"
                >
                  다시 시도
                </button>
              </div>
            )}

            {/* History loading or initial messages would start here */}
            <ChatMessagesList
              messages={messages}
              isLoadingMore={isLoadingMore}
              scrollToBottom={scrollToBottomIfNearBottom}
              onScheduleClick={(scheduleId) => {
                router.push(
                  `/schedule-detail?id=${scheduleId}&roomId=${chatRoomId}`,
                );
              }}
            />
          </div>

          <div className="px-4 py-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <button
                type="button"
                className="flex items-center justify-center shrink-0 w-11 h-11 bg-gray-50 text-stone-400 rounded-2xl hover:bg-gray-100 transition-colors"
              >
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
                  className="w-full bg-gray-50 text-stone-800 text-base font-normal leading-relaxed rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#ee2b8c33] transition-all resize-none overflow-y-auto no-scrollbar min-h-[44px]"
                  style={{
                    maxHeight: "120px",
                    fontFamily: "var(--font-kakao), sans-serif",
                    lineHeight: "1.6",
                  }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-300 hover:text-stone-500"
                >
                  <Smile className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleSend}
                onMouseDown={(e) => {
                  if (inputValue.trim()) {
                    e.preventDefault();
                  }
                }}
                disabled={!inputValue.trim()}
                className={`flex items-center justify-center shrink-0 w-11 h-11 rounded-2xl transition-all shadow-lg active:scale-95 ${
                  inputValue.trim()
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
      <CustomAlertModal
        isOpen={alertConfig.isOpen}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
      />
      <ChatRoomNameEditModal
        show={showNameEditModal}
        currentName={roomName}
        onClose={() => setShowNameEditModal(false)}
        onUpdate={handleUpdateRoomName}
      />
    </>
  );
}
