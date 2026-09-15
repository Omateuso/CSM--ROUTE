import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Padrão do Next é 1 MB — muito pouco pra uma foto de câmera de
    // celular real indo pra fn_iniciar_servico/fn_concluir_servico/
    // fn_reportar_pendencia/fn_revisar_servico (app/(tecnico)/servico/[id]/
    // actions.ts). "Concluir" soma até TRÊS evidências numa única Server
    // Action (foto + OS + áudio do relato, 0051) — o bucket `evidencias`
    // (migration 0052) permite até 25MB por arquivo; 60mb cobre a foto
    // (comprimida no cliente, tipicamente <2MB) + a OS (sem compressão,
    // pode chegar nos 25MB do teto) + áudio (pequeno) com folga real, sem
    // abrir demais o corpo da requisição.
    serverActions: {
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
