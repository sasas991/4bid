"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/context/auth";
import { Navbar } from "@/components/navbar";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <Navbar />
        <div className="flex flex-col flex-1">{children}</div>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
