import { SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Card className="mt-4">
      <EmptyState
        icon={<SearchX className="h-5 w-5" />}
        title="Registro não encontrado"
        description="O item pode ter sido arquivado ou o endereço está incorreto."
        action={<ButtonLink href="/" variant="secondary">Voltar ao dashboard</ButtonLink>}
      />
    </Card>
  );
}
