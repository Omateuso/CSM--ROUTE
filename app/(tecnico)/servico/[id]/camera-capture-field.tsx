"use client";

import { useId, useRef, useState } from "react";
import { FIELD_LABEL } from "@/lib/ui/styles";
import { capturarGeolocalizacao, type GeoCoords } from "@/lib/geolocalizacao";
import { decodificarRedimensionada, carregarComoImagem } from "@/lib/ui/imagem-navegador";

// Campo de foto pra Iniciar/Concluir atendimento — parte do pacote de
// integridade operacional (auditoria de segurança, 21/08/2026). Diferente
// do <input type="file"> simples que existia antes: essa foto é
// (1) tirada só pela câmera, (2) tem geolocalização anexada quando
// disponível, e (3) ganha um carimbo visual de data/hora/local antes de
// subir — tudo isso é sinal só pro gerente na tela de validação, o técnico
// nunca vê nada de "suspeito" aqui.
//
// `capture="environment"` é sugestão forte pro navegador abrir a câmera
// traseira, não uma trava garantida do sistema operacional — em alguns
// navegadores/SO ainda pode aparecer a opção de galeria. Dificulta bastante
// reaproveitar uma foto antiga, mas não é impossível de burlar.
//
// Truque de implementação: o input que dispara a captura NÃO tem `name`
// (não participa do form) e fica oculto — quem o técnico vê é o botão
// estilizado "📷 Tire uma foto" (pedido do usuário, 15/09/2026: o rótulo
// padrão do navegador pro input nativo, "Escolher arquivo", não convida a
// abrir a câmera). Depois de processar a foto (geolocalização + carimbo no
// canvas), o arquivo final é injetado via DataTransfer num SEGUNDO input
// oculto que É esse quem tem `name` e de fato viaja no FormData — assim o
// restante do form (`<form action={formAction}>` do useActionState)
// continua funcionando exatamente como antes, sem precisar mexer no
// mecanismo de submit.
//
// Validação "de verdade" (bloquear iniciar/concluir sem a foto) fica nas
// funções do banco (fn_iniciar_servico/fn_concluir_servico, migration
// 0023) — aqui só desabilitamos o botão de enviar via `onReadyChange`
// enquanto não há foto processada, pra dar feedback imediato. Não
// dependemos do atributo HTML `required` no input oculto porque um
// controle com `display:none` fica fora da validação nativa do navegador
// em alguns casos — não é garantia suficiente sozinho.

type Props = {
  name: string;
  label: string;
  onReadyChange?: (ready: boolean) => void;
};

type Status = "vazio" | "processando" | "pronto" | "erro";

// Câmeras de celular modernas tiram fotos em resolução nativa bem acima do
// que essa foto precisa pra documentar um atendimento (12-48MP não é raro)
// — sem redimensionar, o JPEG carimbado passava fácil de vários MB e
// estourava o limite de corpo de Server Action do Next (bug real, achado
// pelo usuário testando em celular de verdade, 27/08/2026: "Concluir" soma
// essa foto + a OS numa única submissão). 2560px no lado maior (subido de
// 1920px em 15/09/2026, pedido do usuário — só ficou seguro aumentar
// depois que `decodificarRedimensionada` (lib/ui/imagem-navegador.ts)
// parou de decodificar em resolução nativa antes de reduzir) mantém
// nitidez de sobra pra evidência/documentação e ainda reduz o arquivo pra
// uma fração do tamanho original.
const MAX_DIMENSAO_PX = 2560;

// Carimbo mostra só data/hora + um aviso neutro de localização, nunca a
// coordenada crua (25/08/2026, pedido do gerente — abrir a foto e ver só
// números não ajuda ninguém a decidir nada; quem confere se a localização
// bate com a RT é o selo verde/vermelho em app/(gerente)/validacao, que já
// faz essa conta). Lat/long continuam indo pro servidor via input oculto
// (`${name}Lat`/`${name}Lng`) — só saíram do carimbo visual da imagem.
function montarLinhasCarimbo(geo: GeoCoords | null): string[] {
  const agora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date());
  const local = geo ? "📍 localização registrada" : "📍 sem localização";
  return [agora, local];
}

async function carimbarFoto(file: File, geo: GeoCoords | null): Promise<File> {
  let bitmap: ImageBitmap | HTMLImageElement;
  let largura: number;
  let altura: number;

  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await decodificarRedimensionada(file, MAX_DIMENSAO_PX);
      largura = bitmap.width;
      altura = bitmap.height;
    } catch {
      // Navegador sem suporte a `resizeWidth`/`resizeHeight` (ou outra
      // falha de decodificação) — cai pro caminho antigo, que redimensiona
      // DEPOIS de decodificar em resolução nativa (mesmo risco de memória
      // de antes desta correção, mas nunca pior do que já era).
      const img = await carregarComoImagem(file);
      const escala = Math.min(1, MAX_DIMENSAO_PX / Math.max(img.naturalWidth, img.naturalHeight));
      largura = Math.round(img.naturalWidth * escala);
      altura = Math.round(img.naturalHeight * escala);
      bitmap = img;
    }
  } else {
    const img = await carregarComoImagem(file);
    const escala = Math.min(1, MAX_DIMENSAO_PX / Math.max(img.naturalWidth, img.naturalHeight));
    largura = Math.round(img.naturalWidth * escala);
    altura = Math.round(img.naturalHeight * escala);
    bitmap = img;
  }

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a foto.");

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();

  const linhas = montarLinhasCarimbo(geo);
  const fontSize = Math.max(16, Math.round(canvas.width * 0.024));
  const padding = fontSize * 0.6;
  ctx.font = `${fontSize}px sans-serif`;
  const larguraTexto = Math.max(...linhas.map((l) => ctx.measureText(l).width));
  const larguraFaixa = larguraTexto + padding * 2;
  const alturaLinha = fontSize * 1.35;
  const alturaFaixa = linhas.length * alturaLinha + padding;

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, canvas.height - alturaFaixa, larguraFaixa, alturaFaixa);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  linhas.forEach((linha, i) => {
    ctx.fillText(linha, padding / 2, canvas.height - alturaFaixa + padding / 2 + i * alturaLinha);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a foto."))), "image/jpeg", 0.9);
  });

  const nomeBase = file.name.replace(/\.\w+$/, "") || "foto";
  return new File([blob], `${nomeBase}-carimbada.jpg`, { type: "image/jpeg" });
}

function IconeCamera() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <path d="M4 8a2 2 0 0 1 2-2h1.3l1-1.5h7.4l1 1.5H18a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.8" r="3.4" />
    </svg>
  );
}

export function CameraCaptureField({ name, label, onReadyChange }: Props) {
  const uid = useId();
  const inputId = `${uid}-picker`;
  const pickerRef = useRef<HTMLInputElement>(null);
  const hiddenFileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>("vazio");
  const [erro, setErro] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [geoLabel, setGeoLabel] = useState<string | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite tocar de novo (retirar a mesma foto) sem travar o onChange

    if (!file) return;

    setStatus("processando");
    setErro(null);
    onReadyChange?.(false);

    try {
      const geo = await capturarGeolocalizacao();
      const stamped = await carimbarFoto(file, geo);

      const dt = new DataTransfer();
      dt.items.add(stamped);
      if (hiddenFileRef.current) hiddenFileRef.current.files = dt.files;

      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(stamped);
      });
      setLat(geo ? String(geo.lat) : "");
      setLng(geo ? String(geo.lng) : "");
      setGeoLabel(geo ? "📍 localização capturada" : "📍 sem localização");
      setStatus("pronto");
      onReadyChange?.(true);
    } catch {
      setErro("Não foi possível processar a foto. Tente de novo.");
      setStatus("erro");
      onReadyChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={FIELD_LABEL}>
        {label}
      </label>

      {/* Oculto — o técnico nunca vê o input nativo nem o rótulo padrão do
          navegador ("Escolher arquivo"), só o botão abaixo. */}
      <input
        ref={pickerRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
      />

      {/* Input oculto que de fato viaja no FormData — recebe o arquivo já
          carimbado via DataTransfer, nunca o arquivo original escolhido. */}
      <input ref={hiddenFileRef} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden="true" />
      <input type="hidden" name={`${name}Lat`} value={lat} />
      <input type="hidden" name={`${name}Lng`} value={lng} />

      <button
        type="button"
        onClick={() => pickerRef.current?.click()}
        disabled={status === "processando"}
        className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-accent bg-accent/5 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
      >
        <span aria-hidden="true">
          <IconeCamera />
        </span>
        {status === "processando" ? "Processando..." : status === "pronto" ? "Tirar outra foto" : "Tire uma foto"}
      </button>

      {status === "erro" && erro && (
        <p role="alert" className="text-xs text-danger">
          {erro}
        </p>
      )}
      {status === "pronto" && previewUrl && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview local de um blob, nunca uma URL remota */}
          <img src={previewUrl} alt="" className="h-14 w-14 rounded-[var(--radius-sm)] object-cover" />
          <span className="text-xs text-text-tertiary">{geoLabel}</span>
        </div>
      )}
    </div>
  );
}
