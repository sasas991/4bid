"use client";

import { AuthProvider } from "@/context/auth";
import { Navbar } from "@/components/navbar";
import { SolanaProvider } from "@/components/solana-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProvider>
      <AuthProvider>
        <Navbar />
        <div className="flex flex-col flex-1">{children}</div>
      </AuthProvider>
    </SolanaProvider>
  );
}
