import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={{ id: user.id, name: user.full_name || user.email || "Usuário", email: user.email, role: user.role, isOwner: user.isOwner }}>
      {children}
    </AppShell>
  );
}
