import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { BrandWordmark } from "@/components/layout/brand";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; inativo?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* Fundo: textura sutil de linhas na cor bronze */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgb(139 107 74 / 0.22), transparent 70%), linear-gradient(rgb(255 255 255 / 0.025) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.025) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 48px 48px, 48px 48px",
        }}
      />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <BrandWordmark />
        </div>
        <LoginForm next={safeInternalPath(sp.next) ?? undefined} inactive={sp.inativo === "1"} />
        <p className="mt-6 text-center text-[12px] text-fg-subtle">Acesso restrito à equipe PLASCOTEL.</p>
      </div>
    </main>
  );
}
