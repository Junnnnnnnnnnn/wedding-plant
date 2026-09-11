"use client";

import { useParams } from "next/navigation";
import FeedDetailView from "../FeedDetailView";

/**
 * 후기 상세. 쿼리를 읽어 넘기기만 하는 얇은 래퍼다 —
 * `app/add-plen/page.tsx` · `app/chat/[chatRoomId]` 와 같은 구조.
 */
export default function FeedDetailPage() {
  const params = useParams();
  const raw = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const postId = Number(raw);

  if (!Number.isFinite(postId)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-8 text-center">
        <p className="text-[14px] text-[#7a6c74]">잘못된 주소예요.</p>
      </div>
    );
  }

  return <FeedDetailView postId={postId} />;
}
