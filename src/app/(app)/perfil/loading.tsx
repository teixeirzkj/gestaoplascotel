import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" role="status" aria-label="Carregando">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
