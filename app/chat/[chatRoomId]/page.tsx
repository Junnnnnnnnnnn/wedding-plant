"use client";

import { useParams } from "next/navigation";
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
  const chatRoomId = params.chatRoomId as string;

  return <ChatRoomView chatRoomId={chatRoomId} variant="standalone" />;
}
