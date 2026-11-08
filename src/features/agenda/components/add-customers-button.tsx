"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { addVisitCustomersAction } from "../actions";
import { CustomerPicker } from "./customer-picker";

function AddCustomersDialog({
  open,
  onClose,
  visitId,
  cityId,
  cityName,
  existingCustomerIds,
}: {
  open: boolean;
  onClose: () => void;
  visitId: string;
  cityId: string;
  cityName: string;
  existingCustomerIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const exclude = useMemo(() => new Set(existingCustomerIds), [existingCustomerIds]);

  function submit() {
    startTransition(async () => {
      const r = await addVisitCustomersAction({ visitId, customerIds: Array.from(selected) });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Clientes adicionados.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title="Adicionar clientes"
      description={`Clientes de ${cityName} que ainda não estão nesta visita.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={pending} disabled={selected.size === 0}>
            <UserPlus className="h-4 w-4" />
            {selected.size > 0 ? `Adicionar ${selected.size}` : "Adicionar"}
          </Button>
        </>
      }
    >
      {open && <CustomerPicker cityId={cityId} selected={selected} onChange={setSelected} excludeIds={exclude} />}
    </Modal>
  );
}

export function AddCustomersButton({
  variant = "secondary",
  ...props
}: {
  visitId: string;
  cityId: string;
  cityName: string;
  existingCustomerIds: string[];
  variant?: "secondary" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <UserPlus className="h-4 w-4" /> Adicionar clientes
      </Button>
      <AddCustomersDialog key={key} open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}
