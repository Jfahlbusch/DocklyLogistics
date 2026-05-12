import { z } from "zod";

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type PaginationInput = z.infer<typeof PaginationQuery>;

export function pagedMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total };
}
