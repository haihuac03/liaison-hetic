"use client";

import type { ReactNode } from "react";
import { LiaisonProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { PropertyProvider } from "@/lib/property";
import { UIProvider } from "@/lib/ui";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider><LiaisonProvider><PropertyProvider>
      <UIProvider>{children}</UIProvider>
    </PropertyProvider>
    </LiaisonProvider></AuthProvider>
  );
}
