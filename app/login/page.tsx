import type { Metadata } from "next";
import LoginClient from "./login-client";

export const metadata: Metadata = {
  title: "Sistema de Rota Inteligente — Acesso",
};

export default function LoginPage() {
  return <LoginClient />;
}
