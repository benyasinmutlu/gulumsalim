import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductQuestionsView from "@/components/product-questions-view";

interface Props {
  params: Promise<{ slug: string; product: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Ürün Soruları | Gülüm Şalım" };
}

export default async function CategoryProductQuestionsPage({ params }: Props) {
  const { slug, product } = await params;
  const view = await ProductQuestionsView({ slug: product, expectedCategorySlug: slug });
  if (!view) notFound();
  return view;
}
