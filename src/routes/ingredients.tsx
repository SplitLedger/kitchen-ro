import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/empty-page";

export const Route = createFileRoute("/ingredients")({
  component: IngredientsPage,
});

function IngredientsPage() {
  return <EmptyPage title="Ingredients" description="Ingredient editing is not available yet." />;
}
