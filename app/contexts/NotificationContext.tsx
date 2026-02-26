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
import { getApiBaseUrl, getToken, getPlanUserIdFromToken } from "@/lib/api";
import NotificationToast from "../components/NotificationToast";

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
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const params = useParams();
  const pathname = usePathname();

  // 현재 접속 중인 채팅방 ID를 Ref로 관리 (Clova Closure 문제 해결)
  const currentRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    const isChatPage = pathname?.startsWith("/chat/");
    currentRoomIdRef.current =
      isChatPage && params?.chatRoomId ? String(params.chatRoomId) : null;
  }, [pathname, params]);

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

      // 현재 연결된 ID들과 요청된 ID들을 비교
      const newIds = roomIds.filter((id) => !eventSourcesRef.current.has(id));

      // 새로운 ID들에 대해 SSE 연결 생성
      newIds.forEach((id) => {
        const createConnection = (roomId: number) => {
          try {
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

                // 현재 유저가 이미 해당 채팅방에 있다면 알림 표시하지 않음
                if (
                  currentRoomIdRef.current &&
                  String(roomId) === currentRoomIdRef.current
                ) {
                  return;
                }

                console.log(`[SSE Room ${roomId}] 알림 수신:`, res);

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

            es.onerror = (err) => {
              console.error(`[SSE Room ${roomId}] 연결 에러:`, err);
              es.close();
              eventSourcesRef.current.delete(roomId);
              // 3초 후 재연결 시도
              setTimeout(() => createConnection(roomId), 3000);
            };
          } catch (err) {
            console.error(`[SSE Room ${roomId}] 연결 생성 실패:`, err);
          }
        };

        createConnection(id);
      });

      console.log(
        "[NotificationProvider] Active SSE connections:",
        Array.from(eventSourcesRef.current.keys()),
      );
    },
    [showToast],
  );

  // 컴포넌트 마운트 시 유저 정보를 가져와서 채팅방 구독 및 카운트 초기화
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = getToken();
    if (!token) return;

    const initNotifications = async () => {
      try {
        const userRes = await fetchApi("/plan/user");
        if (!userRes.ok) return;

        const userJson = await userRes.json();
        if (userJson.result && userJson.data?.chatRooms) {
          const roomIds = userJson.data.chatRooms.map(
            (r: { id: number }) => r.id,
          );
          console.log(
            `[NotificationContext] Initializing subscriptions for rooms: ${roomIds.join(", ")}`,
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
  }, [subscribeToChatRooms, updateRoomUnreadCount, updateUnreadCount]);

  // 컴포넌트 언마운트 시 모든 연결 종료
  useEffect(() => {
    const eventSources = eventSourcesRef.current;
    return () => {
      eventSources.forEach((es) => es.close());
      eventSources.clear();
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
