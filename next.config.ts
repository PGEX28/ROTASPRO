import type { NextConfig } from "next";

const nextConfig: any = {
  // Configuração especial para resolver o workspace root incorreto em ambiente local (Windows)
  // No Vercel (Linux), deixamos o padrão.
  ...(process.env.NODE_ENV === 'development' ? {
    turbopack: {
      root: "C:\\Users\\PABLO SILVA\\Desktop\\CORRETOR DE ROTAS V2",
    },
  } : {}),
};

export default nextConfig;
