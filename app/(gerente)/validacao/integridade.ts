import { haversineKm } from "@/lib/routing/proximity";
import { EVIDENCIA_DISTANCIA_LIMITE_KM } from "@/lib/routing/config";

export type EvidenciaComGeo = {
  tipo: "foto" | "os" | "documento" | "audio";
  momento: "antes" | "depois" | "revisao" | null;
  latitude: number | null;
  longitude: number | null;
  hashArquivo: string | null;
  url: string | null;
};

export type StatusLocalizacaoFoto = "sem_foto" | "sem_localizacao" | "confere" | "fora_do_limite";

// Compara a geolocalização capturada na foto de fechamento com a RT
// cadastrada — "depois" pro atendimento completo, "revisao" pro fluxo leve
// de revisão (0047, sem foto "depois"). "sem_foto" cobre serviço concluído
// antes da migration 0023 (não tem foto de conclusão nenhuma) — não é sinal
// de nada, só ausência de dado antigo.
export function avaliarLocalizacaoConclusao(
  evidencias: EvidenciaComGeo[],
  rt: { latitude: number | null; longitude: number | null },
): StatusLocalizacaoFoto {
  const fotoFinal = evidencias.find(
    (e) => e.tipo === "foto" && (e.momento === "depois" || e.momento === "revisao"),
  );
  if (!fotoFinal) return "sem_foto";

  if (fotoFinal.latitude == null || fotoFinal.longitude == null || rt.latitude == null || rt.longitude == null) {
    return "sem_localizacao";
  }

  const distanciaKm = haversineKm(
    { lat: fotoFinal.latitude, lng: fotoFinal.longitude },
    { lat: rt.latitude, lng: rt.longitude },
  );

  return distanciaKm > EVIDENCIA_DISTANCIA_LIMITE_KM ? "fora_do_limite" : "confere";
}

// Pacote 2 (auditoria de segurança, 21/08/2026) — detecta OS reaproveitada
// entre serviços diferentes por hash SHA-256 do arquivo (calculado no
// server action de upload, migration 0024). `rows` é o resultado de uma
// única query em `evidencias where tipo = 'os'` (todo o projeto, não só a
// página atual) — comparar contra outra técnica/data é o objetivo.
//
// Ajuste de regra pedido pelo usuário (27/08/2026), depois de testar com
// dois chamados fictícios reais e não conseguir saber qual dos dois era a
// OS "de origem": antes o selo era simétrico (os dois lados viam o mesmo
// aviso ⚠️). Agora `rows` precisa vir ordenado por `criado_em` ascendente
// (responsabilidade de quem chama, ver app/(gerente)/validacao/page.tsx) —
// o primeiro servicoId de cada grupo é sempre quem anexou aquele arquivo
// primeiro ("original"); os demais são "reaproveitada". O aviso ⚠️ só
// aparece nos reaproveitados, referenciando o original; o original ganha um
// selo neutro avisando que essa OS foi reaproveitada depois.
export type OsHashRow = { servicoId: string; hashArquivo: string; criadoEm: string };
export type OsDuplicadaRef = { rtCodigo: string; rotaData: string | null };
export type OsPapel = "original" | "reaproveitada";
export type OsIntegridadeInfo = { papel: OsPapel; ref: OsDuplicadaRef };

export function detectarHashesDuplicados(rows: OsHashRow[]): Map<string, string[]> {
  const porHash = new Map<string, string[]>();
  for (const r of rows) {
    const lista = porHash.get(r.hashArquivo) ?? [];
    if (!lista.includes(r.servicoId)) lista.push(r.servicoId);
    porHash.set(r.hashArquivo, lista);
  }
  const duplicados = new Map<string, string[]>();
  for (const [hash, ids] of porHash) {
    if (ids.length > 1) duplicados.set(hash, ids);
  }
  return duplicados;
}

// Pra um serviço específico, diz se a OS dele é a "original" (primeira vez
// que aquele arquivo apareceu) ou "reaproveitada" (mesmo hash de um
// serviço anterior) — e traz uma referência (RT + data) do outro lado.
// Não precisa listar todo mundo se houver mais de dois com o mesmo hash,
// uma referência já é suficiente pro gerente investigar.
export function avaliarIntegridadeOs(
  servicoId: string,
  evidencias: EvidenciaComGeo[],
  hashesDuplicados: Map<string, string[]>,
  refPorServicoId: Map<string, OsDuplicadaRef>,
): OsIntegridadeInfo | null {
  const os = evidencias.find((e) => e.tipo === "os");
  if (!os?.hashArquivo) return null;

  const grupo = hashesDuplicados.get(os.hashArquivo);
  if (!grupo || grupo.length < 2) return null;

  const [originalId, ...reaproveitadasIds] = grupo;

  if (servicoId === originalId) {
    const ref = refPorServicoId.get(reaproveitadasIds[0]);
    return ref ? { papel: "original", ref } : null;
  }

  const ref = refPorServicoId.get(originalId);
  return ref ? { papel: "reaproveitada", ref } : null;
}
