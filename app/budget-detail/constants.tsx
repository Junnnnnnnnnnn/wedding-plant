import React from "react";
import {
  Utensils,
  Diamond,
  Camera,
  Gift,
  Flower2,
  Shirt,
  MoreHorizontal,
} from "lucide-react";
import { Expense } from "./types";

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Dinner Venue": <Utensils className="w-5 h-5" />,
  "저녁 식사": <Utensils className="w-5 h-5" />,

  "Wedding Ring": <Diamond className="w-5 h-5" />,
  결혼반지: <Diamond className="w-5 h-5" />,

  Photography: <Camera className="w-5 h-5" />,

  "Parent's Gift": <Gift className="w-5 h-5" />,
  "혼주 구매": <Gift className="w-5 h-5" />,

  Flowers: <Flower2 className="w-5 h-5" />,
  Attire: <Shirt className="w-5 h-5" />,
  Others: <MoreHorizontal className="w-5 h-5" />,
};

export const INITIAL_EXPENSES: Expense[] = [];
// We will populate this from the page component using the user provided data
