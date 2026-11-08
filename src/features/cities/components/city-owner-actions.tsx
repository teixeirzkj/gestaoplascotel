"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/misc";
import { useShellUser } from "@/components/layout/app-shell";
import { setCityArchivedAction } from "../actions";
import { CityFormDialog, type CityFormValues } from "./city-form-dialog";

/** Botão "Nova cidade" (somente proprietário). */
export function NewCityButton({ className }: { className?: string }) {
  const user = useShellUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  if (!user.isOwner) return null;
  return (
    <>
      <Button
        className={className}
        onClick={() => {
          setFormKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" /> Nova cidade
      </Button>
      <CityFormDialog key={formKey} open={open} onClose={() => setOpen(false)} onSaved={(id) => router.push(`/cidades/${id}`)} />
    </>
  );
}

/** Editar / arquivar / reativar (somente proprietário). compact = ícones para linhas de tabela. */
export function CityOwnerActions({
  city,
  archived,
  compact,
}: {
  city: CityFormValues & { id: string };
  archived: boolean;
  compact?: boolean;
}) {
  const user = useShellUser();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!user.isOwner) return null;

  function toggleArchive() {
    startTransition(async () => {
      const r = await setCityArchivedAction({ id: city.id, archived: !archived });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Cidade atualizada.");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  const openEdit = () => {
    setFormKey((k) => k + 1);
    setEditOpen(true);
  };

  return (
    <>
      {compact ? (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={openEdit} aria-label={`Editar ${city.name}`} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmOpen(true)}
            aria-label={archived ? `Reativar ${city.name}` : `Arquivar ${city.name}`}
            title={archived ? "Reativar" : "Arquivar"}
          >
            {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <>
          <Button variant="secondary" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
            {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {archived ? "Reativar" : "Arquivar"}
          </Button>
        </>
      )}
      <CityFormDialog key={formKey} open={editOpen} onClose={() => setEditOpen(false)} city={city} />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={toggleArchive}
        loading={pending}
        title={archived ? `Reativar ${city.name}?` : `Arquivar ${city.name}?`}
        description={
          archived
            ? "A cidade volta a aparecer nas listas, na agenda e no cadastro de clientes."
            : "A cidade sai das listas e da agenda. Clientes, vendas e histórico são mantidos."
        }
        confirmLabel={archived ? "Reativar" : "Arquivar"}
      />
    </>
  );
}
