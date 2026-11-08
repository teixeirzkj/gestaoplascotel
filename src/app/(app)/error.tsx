"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";
import { Card } from "@/components/ui/card";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mt-4">
      <ErrorState
        title="Algo deu errado ao carregar esta página"
        description="Seus dados estão seguros. Tente novamente; se persistir, verifique a conexão."
        onRetry={reset}
      />
    </Card>
  );
}
