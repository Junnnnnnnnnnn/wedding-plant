"use client";

import React, { createContext, useContext, useRef, useCallback, useEffect, useState } from "react";
import { getApiBaseUrl, getToken, getPlanUserIdFromToken } from "@/lib/api";
import NotificationToast from "../components/NotificationToast";

interface NotificationContextType {
    subscribeToChatRooms: (roomIds: number[]) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const eventSourcesRef = useRef<Map<number, EventSource>>(new Map());
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        roomId: 0
    });

    const closeToast = useCallback(() => {
        setToastState(prev => ({ ...prev, show: false }));
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
    }, []);

    const showToast = useCallback((senderName: string, message: string, roomId: number, senderImage?: string | null) => {
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
            roomId
        });

        // 5초 뒤 자동 종료
        toastTimerRef.current = setTimeout(() => {
            closeToast();
        }, 5000);
    }, [closeToast]);

    const subscribeToChatRooms = useCallback((roomIds: number[]) => {
        if (typeof window === "undefined") return;
        const token = getToken();
        if (!token) return;

        const myUserId = getPlanUserIdFromToken();
        const baseUrl = getApiBaseUrl().replace(/\/+$/, "");

        // 현재 연결된 ID들과 요청된 ID들을 비교
        const currentIds = Array.from(eventSourcesRef.current.keys());
        const newIds = roomIds.filter(id => !eventSourcesRef.current.has(id));

        // 새로운 ID들에 대해 SSE 연결 생성
        newIds.forEach(id => {
            const createConnection = (roomId: number) => {
                try {
                    // 이미 연결되어 있다면 패스
                    if (eventSourcesRef.current.has(roomId)) return;

                    const es = new EventSource(`${baseUrl}/plan/notification/chat/${roomId}`);
                    eventSourcesRef.current.set(roomId, es);

                    es.onmessage = (event) => {
                        try {
                            const res = JSON.parse(event.data);
                            if (res.type === "keep-alive") return;

                            // 내 메시지면 알림 무시
                            if (res.data?.planUserId === myUserId) {
                                return;
                            }

                            console.log(`[SSE Room ${roomId}] 알림 수신:`, res);

                            // 토스트 알림 표시
                            if (res.data) {
                                showToast(
                                    res.data.planUserName || "새 메시지",
                                    res.data.text || "메시지가 도착했습니다.",
                                    roomId,
                                    res.data.planUserProfileImageUrl
                                );
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

        console.log("[NotificationProvider] Active SSE connections:", Array.from(eventSourcesRef.current.keys()));
    }, []);

    // 컴포넌트 언마운트 시 모든 연결 종료
    useEffect(() => {
        return () => {
            eventSourcesRef.current.forEach(es => es.close());
            eventSourcesRef.current.clear();
        };
    }, []);

    return (
        <NotificationContext.Provider value={{ subscribeToChatRooms }}>
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
        throw new Error("useNotification must be used within a NotificationProvider");
    }
    return context;
}
