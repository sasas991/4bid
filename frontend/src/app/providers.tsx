"use client";

import { AuthProvider } from "@/context/auth";
import { Header } from "@/components/header";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </AuthProvider>
  );
}
