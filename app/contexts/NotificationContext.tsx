"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { useParams, usePathname } from "next/navigation";
import {
  AUTH_TOKEN_CHANGED_EVENT,
  getApiBaseUrl,
  getToken,
  getPlanUserIdFromToken,
} from "@/lib/api";
import NotificationToast from "../components/NotificationToast";

/** SSE 재연결: 첫 지연 3초에서 시작해 2배씩, 최대 1분, 6회까지만 시도 */
const SSE_BASE_DELAY_MS = 3000;
const SSE_MAX_DELAY_MS = 60000;
const SSE_MAX_RETRIES = 6;

/** NotificationContext 전용 fetch 함수 (ApiContext 의존성 없이 독립 동작) */
async function fetchApi(url: string): Promise<Response> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, "");
  const token = getToken();
  return fetch(`${baseUrl}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

interface NotificationContextType {
  unreadCount: number;
  roomUnreadCounts: Record<number, number>;
  subscribeToChatRooms: (roomIds: number[]) => void;
  updateUnreadCount: (count: number) => void;
  updateRoomUnreadCount: (roomId: number, count: number) => void;
  resetUnreadCount: () => void;
  resetRoomUnreadCount: (roomId: number) => void;
  getRoomUnreadCount: (roomId: number) => number;
  /**
   * 지금 사용자가 보고 있는 채팅방을 알린다. 그 방의 토스트는 뜨지 않는다.
   *
   * 채팅이 /chat/[id] 라우트에만 있던 시절에는 pathname 으로 판단해도
   * 충분했다. 넓은 화면에서 목록 옆 pane 으로 열리면 경로가 /plan-list 라
   * 판단이 빗나가, 보고 있는 방의 메시지가 그대로 토스트로 떴다.
   * 채팅 뷰가 마운트/언마운트 시 직접 호출한다.
   */
  setActiveRoomId: (roomId: string | number | null) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const eventSourcesRef = useRef<Map<number, EventSource>>(new Map());
  const reconnectTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  /** 방별 연속 실패 횟수 (지수 백오프 계산용) */
  const retryCountsRef = useRef<Map<number, number>>(new Map());
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const params = useParams();
  const pathname = usePathname();

  // 현재 접속 중인 채팅방 ID를 Ref로 관리 (Clova Closure 문제 해결)
  //
  // routeRoomIdRef : /chat/[id] 라우트에서 경로로 유추한 값 (fallback)
  // activeRoomIdRef: 채팅 뷰가 setActiveRoomId 로 직접 알려준 값 (우선)
  //
  // pane 으로 열린 채팅은 경로가 /plan-list 라 라우트로는 알 수 없다.
  // 명시 값이 있으면 그것을 쓰고, 없을 때만 경로로 떨어진다.
  const routeRoomIdRef = useRef<string | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    const isChatPage = pathname?.startsWith("/chat/");
    routeRoomIdRef.current =
      isChatPage && params?.chatRoomId ? String(params.chatRoomId) : null;
  }, [pathname, params]);

  const setActiveRoomId = useCallback((roomId: string | number | null) => {
    activeRoomIdRef.current = roomId == null ? null : String(roomId);
  }, []);

  const [toastState, setToastState] = useState<{
    show: boolean;
    senderName: string;
    message: string;
    senderImage?: string | null;
    roomId: number;
  }>({
    show: false,
    senderName: "",
    message: "",
    senderImage: null,
    roomId: 0,
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [roomUnreadCounts, setRoomUnreadCounts] = useState<
    Record<number, number>
  >({});

  const updateUnreadCount = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  const updateRoomUnreadCount = useCallback((roomId: number, count: number) => {
    setRoomUnreadCounts((prev) => ({
      ...prev,
      [roomId]: count,
    }));
  }, []);

  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const resetRoomUnreadCount = useCallback((roomId: number) => {
    setRoomUnreadCounts((prev) => ({
      ...prev,
      [roomId]: 0,
    }));
  }, []);

  const getRoomUnreadCount = useCallback(
    (roomId: number) => {
      return roomUnreadCounts[roomId] || 0;
    },
    [roomUnreadCounts],
  );

  const closeToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, show: false }));
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (
      senderName: string,
      message: string,
      roomId: number,
      senderImage?: string | null,
    ) => {
      // 기존 타이머 제거 (새 메시지가 오면 갱신)
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      // 상태 업데이트 (Singleton: 이전 건 자동으로 대체됨)
      setToastState({
        show: true,
        senderName,
        message,
        senderImage,
        roomId,
      });

      // 5초 뒤 자동 종료
      toastTimerRef.current = setTimeout(() => {
        closeToast();
      }, 5000);
    },
    [closeToast],
  );

  const subscribeToChatRooms = useCallback(
    (roomIds: number[]) => {
      if (typeof window === "undefined") return;
      const token = getToken();
      if (!token) return;

      const myUserId = getPlanUserIdFromToken();
      const baseUrl = getApiBaseUrl().replace(/\/+$/, "");

      // 더 이상 필요 없는 방의 연결을 먼저 닫는다.
      // 예전에는 추가만 하고 닫지 않아 방을 옮길수록 EventSource가 쌓였고,
      // 호스트당 동시 연결 한도를 넘기면 일반 API 요청까지 멈췄다.
      const wanted = new Set(roomIds);
      eventSourcesRef.current.forEach((es, id) => {
        if (wanted.has(id)) return;
        es.close();
        eventSourcesRef.current.delete(id);
        const pendingTimer = reconnectTimersRef.current.get(id);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          reconnectTimersRef.current.delete(id);
        }
        retryCountsRef.current.delete(id);
      });

      // 현재 연결된 ID들과 요청된 ID들을 비교
      const newIds = roomIds.filter((id) => !eventSourcesRef.current.has(id));

      // 새로운 ID들에 대해 SSE 연결 생성
      newIds.forEach((id) => {
        const createConnection = (roomId: number) => {
          try {
            // 재연결로 들어온 경우 pending 타이머 정리
            const pending = reconnectTimersRef.current.get(roomId);
            if (pending) {
              clearTimeout(pending);
              reconnectTimersRef.current.delete(roomId);
            }
            // 이미 연결되어 있다면 패스
            if (eventSourcesRef.current.has(roomId)) return;

            const es = new EventSource(
              `${baseUrl}/plan/notification/chat/${roomId}`,
            );
            eventSourcesRef.current.set(roomId, es);

            es.onmessage = (event) => {
              try {
                const res = JSON.parse(event.data);
                if (res.type === "keep-alive") return;

                // 내 메시지면 알림 무시
                if (res.data?.planUserId === myUserId) {
                  return;
                }

                // 현재 유저가 이미 해당 채팅방을 보고 있다면 알림 표시하지 않음
                const viewingRoomId =
                  activeRoomIdRef.current ?? routeRoomIdRef.current;
                if (viewingRoomId && String(roomId) === viewingRoomId) {
                  return;
                }

                // 토스트 알림 표시
                if (res.data) {
                  let notificationMessage =
                    res.data.text || "메시지가 도착했습니다.";

                  // 스케줄 데이터가 있는 경우 메시지 구성
                  if (
                    res.data.messageType === "schedule" &&
                    res.data.schedule
                  ) {
                    const s = res.data.schedule;
                    const amountStr = s.amount
                      ? `${s.amount.toLocaleString()}만원`
                      : "";
                    const dateStr = s.startDate
                      ? ` (${new Date(s.startDate).toLocaleDateString()})`
                      : "";
                    notificationMessage = `플랜을 공유했어요! [${s.categoryName}] ${s.title}${amountStr ? ` - ${amountStr}` : ""}${dateStr}`;
                  }

                  showToast(
                    res.data.planUserName || "새 메시지",
                    notificationMessage,
                    roomId,
                    res.data.planUserProfileImageUrl,
                  );

                  // SSE 메시지 수신 시 읽지 않은 카운트 증가
                  setUnreadCount((prev) => prev + 1);
                  setRoomUnreadCounts((prev) => ({
                    ...prev,
                    [roomId]: (prev[roomId] || 0) + 1,
                  }));
                }
              } catch (e) {
                console.error(`[SSE Room ${roomId}] 데이터 파싱 에러:`, e);
              }
            };

            es.onopen = () => {
              // 연결에 성공하면 백오프를 초기화한다
              retryCountsRef.current.set(roomId, 0);
            };

            es.onerror = (err) => {
              console.error(`[SSE Room ${roomId}] 연결 에러:`, err);
              es.close();
              eventSourcesRef.current.delete(roomId);

              // 지수 백오프 + 재시도 상한.
              // 예전에는 조건 없이 3초마다 무한 재연결해, 백엔드가 계속
              // 실패하면 방마다 분당 20회씩 요청이 나갔다.
              const attempt = (retryCountsRef.current.get(roomId) ?? 0) + 1;
              retryCountsRef.current.set(roomId, attempt);
              if (attempt > SSE_MAX_RETRIES) {
                console.error(
                  `[SSE Room ${roomId}] 재연결 ${SSE_MAX_RETRIES}회 실패, 중단합니다.`,
                );
                return;
              }
              const delay = Math.min(
                SSE_BASE_DELAY_MS * 2 ** (attempt - 1),
                SSE_MAX_DELAY_MS,
              );
              const timer = setTimeout(() => {
                reconnectTimersRef.current.delete(roomId);
                createConnection(roomId);
              }, delay);
              reconnectTimersRef.current.set(roomId, timer);
            };
          } catch (err) {
            console.error(`[SSE Room ${roomId}] 연결 생성 실패:`, err);
          }
        };

        createConnection(id);
      });
    },
    [showToast],
  );

  // 유저 정보를 가져와 채팅방 구독 및 카운트 초기화.
  //
  // 예전에는 마운트 시점에 토큰이 있어야만 동작했고 의존성이 전부 안정적이라
  // 1회만 실행됐다. OAuth 콜백 착지 시점엔 아직 앱 JWT 가 없고, 로그인 후에도
  // Provider 가 언마운트되지 않아 미읽음 배지가 0 으로 남았다.
  // 토큰 변경 이벤트를 구독해 로그인 직후에도 초기화한다.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const initNotifications = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const userRes = await fetchApi("/plan/user");
        if (!userRes.ok) return;

        const userJson = await userRes.json();
        if (userJson.result && userJson.data?.chatRooms) {
          const roomIds = userJson.data.chatRooms.map(
            (r: { id: number }) => r.id,
          );
          subscribeToChatRooms(roomIds);

          // 모든 채팅방에 대해 읽지 않은 카운트 합산
          let totalUnread = 0;
          await Promise.all(
            roomIds.map(async (rid: number) => {
              try {
                const countRes = await fetchApi(
                  `/plan/chat/message/count/${rid}`,
                );
                if (countRes.ok) {
                  const countJson = await countRes.json();
                  if (countJson.result) {
                    const c = countJson.data.count || 0;
                    updateRoomUnreadCount(rid, c);
                    totalUnread += c;
                  }
                }
              } catch (err) {
                console.error(`Failed to fetch count for room ${rid}:`, err);
              }
            }),
          );
          updateUnreadCount(totalUnread);
        }
      } catch (error) {
        console.error(
          "[NotificationContext] Failed to initialize notifications:",
          error,
        );
      }
    };

    initNotifications();

    const handleTokenChanged = () => {
      initNotifications();
    };
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChanged);
    return () =>
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChanged);
  }, [subscribeToChatRooms, updateRoomUnreadCount, updateUnreadCount]);

  // 컴포넌트 언마운트 시 모든 연결/재연결 타이머 종료
  useEffect(() => {
    const eventSources = eventSourcesRef.current;
    const reconnectTimers = reconnectTimersRef.current;
    return () => {
      eventSources.forEach((es) => es.close());
      eventSources.clear();
      reconnectTimers.forEach((t) => clearTimeout(t));
      reconnectTimers.clear();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      unreadCount,
      roomUnreadCounts,
      subscribeToChatRooms,
      updateUnreadCount,
      updateRoomUnreadCount,
      resetUnreadCount,
      resetRoomUnreadCount,
      getRoomUnreadCount,
      setActiveRoomId,
    }),
    [
      unreadCount,
      roomUnreadCounts,
      subscribeToChatRooms,
      updateUnreadCount,
      updateRoomUnreadCount,
      resetUnreadCount,
      resetRoomUnreadCount,
      getRoomUnreadCount,
      setActiveRoomId,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
      <NotificationToast
        show={toastState.show}
        senderName={toastState.senderName}
        message={toastState.message}
        senderImage={toastState.senderImage}
        roomId={toastState.roomId}
        onClose={closeToast}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
}
