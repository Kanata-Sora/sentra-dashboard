import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  open: "未着手",
  in_progress: "進行中",
  done: "完了",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

export const CATEGORY_LABELS: Record<string, string> = {
  technical: "技術",
  decision: "決定事項",
  issue: "課題",
  other: "その他",
};

export const CATEGORY_COLORS: Record<string, string> = {
  technical: "bg-purple-100 text-purple-700",
  decision: "bg-yellow-100 text-yellow-700",
  issue: "bg-red-100 text-red-700",
  other: "bg-gray-100 text-gray-700",
};
