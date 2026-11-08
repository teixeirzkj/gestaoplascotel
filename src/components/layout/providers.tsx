"use client";

import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";

/** reducedMotion="user": respeita a preferência de redução de movimento do sistema. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        closeButton
        duration={4000}
        toastOptions={{
          style: { background: "#262626", border: "1px solid rgb(255 255 255 / 0.12)", color: "#f5f5f4", borderRadius: 14 },
        }}
      />
    </MotionConfig>
  );
}
