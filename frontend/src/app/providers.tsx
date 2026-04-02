"use client";

import { AuthProvider } from "@/context/auth";
import { Navbar } from "@/components/navbar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Navbar />
      <div className="flex flex-col flex-1">{children}</div>
    </AuthProvider>
  );
}
