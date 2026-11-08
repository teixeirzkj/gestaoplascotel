"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

/** Avisa quando o usuário foi redirecionado de uma página exclusiva do proprietário (?acesso=negado). */
export function AccessNotice({ denied }: { denied: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef(false);
  useEffect(() => {
    if (!denied || shown.current) return;
    shown.current = true;
    toast.warning("Página exclusiva do proprietário", {
      description: "Peça ao proprietário caso precise deste acesso.",
    });
    router.replace(pathname, { scroll: false });
  }, [denied, pathname, router]);
  return null;
}
