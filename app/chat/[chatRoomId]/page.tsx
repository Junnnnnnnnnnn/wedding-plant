"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatRoomView from "./ChatRoomView";

/**
 * /chat/[chatRoomId] 라우트.
 *
 * 본문은 ChatRoomView 로 옮겼다. 넓은 화면에서 /plan-list 의 우측 pane 으로
 * 같은 뷰를 그대로 재사용하기 위해서다. 이 페이지는 경로에서 방 id 를 꺼내
 * 넘기는 일만 한다.
 */
export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatRoomId = params.chatRoomId as string;

  /**
   * 넓은 화면에서 이 라우트로 직접 들어오면(링크 공유·새로고침) 전체 화면
   * 채팅이 떠서 좌측 레일도 목록도 없다. 목록 옆 pane 으로 승격시킨다.
   * `/plan-list` 가 반대 방향(좁아지면 이 라우트로)을 이미 맡고 있다.
   *
   * useIsDesktop 대신 matchMedia 를 직접 읽는다. 훅은 서버 스냅샷이 false 라
   * 하이드레이션 직후 한 번 false 로 렌더되는데, 그 타이밍에 이 이펙트가
   * 돌면 승격이 영영 일어나지 않는다.
   */
  const [promoting, setPromoting] = useState(false);
  useEffect(() => {
    if (!chatRoomId) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    setPromoting(true);
    router.replace(`/plan-list?chat=${encodeURIComponent(chatRoomId)}`);
  }, [chatRoomId, router]);

  // 승격 중에는 폰용 전체 화면 채팅을 잠깐이라도 띄우지 않는다
  if (promoting) return <div className="h-[100dvh] bg-[#fcfbfc]" />;

  return <ChatRoomView chatRoomId={chatRoomId} variant="standalone" />;
}
