import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Padrão do Next é 1 MB — muito pouco pra uma foto de câmera de
    // celular real indo pra fn_iniciar_servico/fn_concluir_servico/
    // fn_reportar_pendencia (app/(tecnico)/servico/[id]/actions.ts).
    // "Concluir" soma DUAS evidências (foto + OS) numa única Server
    // Action, e o bucket `evidencias` (migration 0014) já permite até
    // 10 MB por arquivo — 20mb cobre as duas com folga, sem abrir demais
    // (a foto em si já foi reduzida em camera-capture-field.tsx; sobra
    // principalmente pra OS, que pode ser PDF ou foto sem compressão).
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
