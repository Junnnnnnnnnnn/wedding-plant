import React from "react";
import {
  Utensils,
  Diamond,
  Camera,
  Gift,
  Flower2,
  Shirt,
  Church,
  Mail,
  Plane,
  Home,
  Train,
  Users,
  MoreHorizontal,
} from "lucide-react";
import { Expense } from "./types";

const cls = "w-5 h-5";

/**
 * 카테고리 아이콘.
 *
 * **한국어 카테고리가 실제로 쓰이는 값이다.** 예전에는 영어 키와 몇 개의
 * 한국어만 있어서 스드메·예식장·청첩장 같은 흔한 카테고리가 전부 `Others`
 * 의 "..." 로 떨어졌다 — 목록 전체가 같은 아이콘이었다.
 * 새 카테고리를 추가할 때 여기에도 한 줄 넣어 주면 된다.
 */
export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Dinner Venue": <Utensils className={cls} />,
  "저녁 식사": <Utensils className={cls} />,
  상견례: <Utensils className={cls} />,

  "Wedding Ring": <Diamond className={cls} />,
  결혼반지: <Diamond className={cls} />,
  예물: <Diamond className={cls} />,
  예단: <Diamond className={cls} />,

  Photography: <Camera className={cls} />,
  스드메: <Camera className={cls} />,
  본식스냅: <Camera className={cls} />,

  "Parent's Gift": <Gift className={cls} />,
  "혼주 구매": <Gift className={cls} />,

  예식장: <Church className={cls} />,
  웨딩홀: <Church className={cls} />,

  청첩장: <Mail className={cls} />,

  신혼여행: <Plane className={cls} />,
  허니문: <Plane className={cls} />,

  신혼집: <Home className={cls} />,

  기차: <Train className={cls} />,

  하객: <Users className={cls} />,

  한복: <Shirt className={cls} />,
  Attire: <Shirt className={cls} />,

  Flowers: <Flower2 className={cls} />,
  부케: <Flower2 className={cls} />,

  Others: <MoreHorizontal className={cls} />,
};

export const INITIAL_EXPENSES: Expense[] = [];
// We will populate this from the page component using the user provided data
