import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { NameForm, PasswordForm } from "@/features/profile/components/profile-forms";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Meu perfil"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {user.email}
            <Badge tone="brand">{ROLE_LABEL[user.role]}</Badge>
          </span>
        }
      />
      <div className="space-y-4">
        <NameForm initialName={user.full_name} />
        <PasswordForm />
      </div>
    </div>
  );
}
