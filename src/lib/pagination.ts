export type PageSize = 20 | 50 | 100 | "all";

export function parsePageSize(value: string | null): PageSize {
  if (value === "50") return 50;
  if (value === "100") return 100;
  if (value === "all") return "all";
  return 20;
}

export function parsePage(value: string | null): number {
  const n = Number(value ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function getOffset(page: number, pageSize: PageSize) {
  if (pageSize === "all") return 0;
  return (page - 1) * pageSize;
}

export function getTotalPages(total: number, pageSize: PageSize) {
  if (pageSize === "all") return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
