import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductQuestionsView from "@/components/product-questions-view";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Ürün Soruları | Gülüm Şalım" };
}

export default async function ProductQuestionsPage({ params }: Props) {
  const { slug } = await params;
  const view = await ProductQuestionsView({ slug });
  if (!view) notFound();
  return view;
}
