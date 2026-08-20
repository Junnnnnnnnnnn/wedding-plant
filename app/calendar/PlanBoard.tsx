"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { parseLocalDate } from "@/lib/utils";
import PlanTaskCardBody from "../components/PlanTaskCard";
import {
  useScheduleDateMove,
  useScheduleStatusToggle,
} from "../hooks/useScheduleStatusToggle";

export interface BoardItem {
  id: number;
  categoryName: string;
  title: string;
  amount: number | null;
  startDate: string | null;
  status?: string | null;
}

interface PlanBoardProps {
  items: BoardItem[];
  loading?: boolean;
  /** READ 권한이면 완료 토글·드래그·추가를 막는다 */
  canEdit: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** 낙관적 반영과 되돌리기를 부모가 맡는다 (목록의 주인이 부모라서) */
  onItemsChange: (next: BoardItem[]) => void;
  onAdd: (monthKey: string | null) => void;
  /** 실패 안내 */
  onError: (message: string) => void;
}

const UNDATED = "undated";

function monthKeyOf(item: BoardItem): string {
  if (!item.startDate) return UNDATED;
  const d = parseLocalDate(item.startDate);
  if (!d) return UNDATED;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  if (key === UNDATED) return "날짜 미정";
  const [y, m] = key.split("-").map(Number);
  const now = new Date();
  return now.getFullYear() === y ? `${m}월` : `${y}년 ${m}월`;
}

/**
 * 옮길 달의 같은 일자로 보낸다. 31일짜리를 30일뿐인 달로 끌면 말일로 맞춘다.
 * 날짜가 없던 항목은 그 달 1일로 놓는다.
 */
function dateForMove(item: BoardItem, targetKey: string): string | null {
  if (targetKey === UNDATED) return null;
  const [y, m] = targetKey.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const current = item.startDate ? parseLocalDate(item.startDate) : null;
  const day = Math.min(current ? current.getDate() : 1, lastDay);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDayLabel(startDate: string | null): string {
  const d = startDate ? parseLocalDate(startDate) : null;
  if (!d) return "날짜 미정";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 터치는 길게 눌러야 드래그가 시작된다. 그 전에 움직이면 목록 스크롤로 본다 */
const TOUCH_HOLD_MS = 400;
const DRAG_THRESHOLD_PX = 6;
const EDGE_SCROLL_PX = 64;

export default function PlanBoard({
  items,
  loading = false,
  canEdit,
  selectedId,
  onSelect,
  onItemsChange,
  onAdd,
  onError,
}: PlanBoardProps) {
  const { setStatus, isPending } = useScheduleStatusToggle();
  const { moveTo } = useScheduleDateMove();
  const boardRef = useRef<HTMLDivElement>(null);

  const [dragId, setDragId] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  /** 아직 드래그로 승격되지 않은 눌림 상태 */
  const pressRef = useRef<{
    id: number;
    x: number;
    y: number;
    armed: boolean;
    timer: number | null;
  } | null>(null);

  const columns = useMemo(() => {
    const groups = new Map<string, BoardItem[]>();
    items.forEach((item) => {
      const key = monthKeyOf(item);
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    });
    const keys = [...groups.keys()].sort((a, b) => {
      if (a === UNDATED) return -1;
      if (b === UNDATED) return 1;
      return a.localeCompare(b);
    });
    return keys.map((key) => {
      const list = (groups.get(key) ?? [])
        .slice()
        .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
      const sum = list.reduce((acc, i) => acc + (i.amount ?? 0), 0);
      return { key, label: monthLabel(key), list, sum };
    });
  }, [items]);

  const clearPress = useCallback(() => {
    const press = pressRef.current;
    if (press?.timer) window.clearTimeout(press.timer);
    pressRef.current = null;
  }, []);

  const commitMove = useCallback(
    async (id: number, targetKey: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      if (monthKeyOf(item) === targetKey) return;

      const nextDate = dateForMove(item, targetKey);
      if (nextDate === null) {
        // 날짜를 지우는 이동은 지금 지원하지 않는다. 인스펙터에서 수정한다.
        onError("날짜 미정으로 되돌리려면 플랜을 열어 수정해 주세요.");
        return;
      }

      const before = items;
      onItemsChange(
        items.map((i) => (i.id === id ? { ...i, startDate: nextDate } : i)),
      );
      const okResult = await moveTo(id, nextDate);
      if (!okResult) {
        onItemsChange(before);
        onError("일정을 옮기지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    },
    [items, moveTo, onItemsChange, onError],
  );

  // 드래그 중에만 window 리스너를 건다. 카드마다 걸면 포인터가 카드를 벗어난
  // 순간 이벤트가 끊긴다.
  useEffect(() => {
    if (!canEdit) return undefined;

    const findColumnKey = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      const col = el?.closest("[data-board-column]");
      return col ? col.getAttribute("data-board-column") : null;
    };

    const onMove = (e: PointerEvent) => {
      const press = pressRef.current;

      if (dragId !== null) {
        e.preventDefault();
        setDragPoint({ x: e.clientX, y: e.clientY });
        setHoverKey(findColumnKey(e.clientX, e.clientY));

        // 가장자리에서 가로 자동 스크롤
        const board = boardRef.current;
        if (board) {
          const r = board.getBoundingClientRect();
          if (e.clientX < r.left + EDGE_SCROLL_PX) board.scrollLeft -= 18;
          else if (e.clientX > r.right - EDGE_SCROLL_PX) board.scrollLeft += 18;
        }
        return;
      }

      if (!press) return;
      const moved =
        Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y);
      if (moved < DRAG_THRESHOLD_PX) return;

      if (press.armed) {
        setDragId(press.id);
        setDragPoint({ x: e.clientX, y: e.clientY });
      } else {
        // 아직 길게 누르지 않았는데 움직였다 → 스크롤 의도로 보고 취소
        clearPress();
      }
    };

    const onUp = (e: PointerEvent) => {
      if (dragId !== null) {
        const key = findColumnKey(e.clientX, e.clientY);
        if (key) commitMove(dragId, key);
        setDragId(null);
        setDragPoint(null);
        setHoverKey(null);
      }
      clearPress();
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [canEdit, dragId, clearPress, commitMove]);

  const handlePointerDown = (e: React.PointerEvent, item: BoardItem) => {
    if (!canEdit || e.button !== 0) return;
    const isTouch = e.pointerType === "touch";
    const press = {
      id: item.id,
      x: e.clientX,
      y: e.clientY,
      armed: !isTouch,
      timer: null as number | null,
    };
    if (isTouch) {
      press.timer = window.setTimeout(() => {
        if (pressRef.current?.id === item.id) pressRef.current.armed = true;
      }, TOUCH_HOLD_MS);
    }
    pressRef.current = press;
  };

  const handleToggle = async (item: BoardItem) => {
    if (!canEdit || isPending(item.id)) return;
    const next = item.status === "COMPLETED" ? "NORMAL" : "COMPLETED";
    const before = items;
    onItemsChange(
      items.map((i) => (i.id === item.id ? { ...i, status: next } : i)),
    );
    const okResult = await setStatus(item.id, next);
    if (!okResult) {
      onItemsChange(before);
      onError("완료 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const draggingItem =
    dragId !== null ? items.find((i) => i.id === dragId) : null;

  if (loading) {
    return (
      <div className="flex flex-1 gap-4 overflow-hidden px-6 py-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-[262px] shrink-0 space-y-3">
            <div className="skeleton-shimmer h-5 w-24 rounded" />
            <div className="skeleton-shimmer h-[88px] rounded-[20px]" />
            <div className="skeleton-shimmer h-[88px] rounded-[20px]" />
          </div>
        ))}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 text-center">
        <p className="text-[15px] font-bold text-stone-500">
          아직 등록된 플랜이 없어요
        </p>
        <p className="max-w-[280px] text-[13px] leading-relaxed text-gray-400">
          플랜을 추가하면 달별로 나뉘어 여기에 쌓입니다.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => onAdd(null)}
            className="mt-1 inline-flex h-10 items-center gap-1.5 rounded-2xl bg-[#ee2b8c] px-4 text-[13.5px] font-bold text-white shadow-lg shadow-[#ee2b8c33] transition-transform active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            플랜 추가
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        ref={boardRef}
        className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden px-6 pb-6 pt-5"
        style={dragId !== null ? { touchAction: "none" } : undefined}
      >
        {columns.map((col) => {
          const isHover = hoverKey === col.key && dragId !== null;
          return (
            <section
              key={col.key}
              data-board-column={col.key}
              className="flex w-[262px] shrink-0 flex-col xl:w-[282px]"
            >
              <div className="shrink-0 px-1 pb-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-[15px] font-bold tracking-tight text-[#1b0d14]">
                    {col.label}
                  </h2>
                  <span className="rounded-full bg-[#f4eff2] px-2 py-0.5 text-[11px] text-gray-400">
                    {col.list.length}
                  </span>
                  {col.sum > 0 && (
                    <span className="ml-auto text-[12.5px] font-bold tracking-tight text-[#7a6c74]">
                      {col.sum.toLocaleString("ko-KR")}만 원
                    </span>
                  )}
                </div>
                <div
                  className={`mt-2.5 h-[3px] rounded-full transition-colors ${
                    isHover ? "bg-[#ee2b8c]" : "bg-[#f0eaee]"
                  }`}
                />
              </div>

              <div
                className={`grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto rounded-2xl px-1 pb-2 pt-1 transition-colors scrollbar-hide ${
                  isHover ? "bg-[#fff2f6]" : ""
                }`}
              >
                {col.list.map((item) => {
                  const done = item.status === "COMPLETED";
                  const isDragging = dragId === item.id;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => handlePointerDown(e, item)}
                      onClick={() => onSelect(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelect(item.id);
                        }
                      }}
                      // select-none: 마우스로 끌 때 카드 안 글자가 파랗게
                      // 잡히는 걸 막는다. 보드 카드는 본래 선택 대상이 아니다.
                      className={`select-none rounded-[20px] border p-4 text-left shadow-sm transition-all ${
                        canEdit ? "cursor-grab" : "cursor-pointer"
                      } ${isDragging ? "opacity-40" : "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#ee2b8c22]"} ${
                        item.id === selectedId
                          ? "border-[#ee2b8c66] shadow-[0_0_0_1px_#ee2b8c66]"
                          : "border-[#ee2b8c14]"
                      } ${done ? "bg-[#faf8f9]" : "bg-white"}`}
                    >
                      <PlanTaskCardBody
                        item={item}
                        toggleDisabled={!canEdit || isPending(item.id)}
                        onToggle={
                          canEdit ? () => handleToggle(item) : undefined
                        }
                      />
                    </div>
                  );
                })}

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onAdd(col.key === UNDATED ? null : col.key)}
                    className="w-full rounded-[20px] border-[1.5px] border-dashed border-[#f0d9e5] py-3 text-center text-[12.5px] text-[#c9b8c2] transition-colors hover:border-[#ee2b8c66] hover:text-[#ee2b8c]"
                  >
                    + 플랜 추가
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* 끌고 있는 카드의 잔상 */}
      {draggingItem && dragPoint && (
        <div
          className="pointer-events-none fixed z-[300] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[#ee2b8c66] bg-white p-4 shadow-2xl"
          style={{ left: dragPoint.x, top: dragPoint.y }}
        >
          <div className="text-[14.5px] font-bold leading-snug tracking-tight text-[#1b0d14]">
            {draggingItem.title}
          </div>
          <div className="mt-1.5 text-[12px] text-[#7a6c74]">
            {hoverKey && hoverKey !== monthKeyOf(draggingItem)
              ? `${monthLabel(hoverKey)}(으)로 이동`
              : formatDayLabel(draggingItem.startDate)}
          </div>
        </div>
      )}
    </>
  );
}
