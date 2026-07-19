import { decodeCursor, encodeCursor } from "../../lib/pagination";
import {
  findCategoryBySlug,
  findProductBySlug,
  listActiveCategories,
  listActiveProducts,
} from "./catalog.repository";
import type { ListProductsQuery } from "./catalog.schemas";

export async function getCategories() {
  return listActiveCategories();
}

export async function getProducts(query: ListProductsQuery) {
  let categoryId: number | undefined;
  if (query.category) {
    const category = await findCategoryBySlug(query.category);
    if (!category) return { items: [], nextCursor: null };
    categoryId = category.id;
  }

  const cursor = query.cursor ? decodeCursor(query.cursor) : null;

  const rows = await listActiveProducts({
    categoryId,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    cursor,
    limit: query.limit,
  });

  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return { items, nextCursor };
}

export async function getProductBySlug(slug: string) {
  return findProductBySlug(slug);
}
