"use client";

import { useId, useRef, useState } from "react";
import { FIELD_LABEL } from "@/lib/ui/styles";
import { capturarGeolocalizacao, type GeoCoords } from "@/lib/geolocalizacao";

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
// Truque de implementação: o input que o técnico toca NÃO tem `name` (não
// participa do form). Depois de processar a foto (geolocalização + carimbo
// no canvas), o arquivo final é injetado via DataTransfer num input de
// arquivo oculto que É esse quem tem `name` e de fato viaja no FormData —
// assim o restante do form (`<form action={formAction}>` do
// useActionState) continua funcionando exatamente como antes, sem precisar
// mexer no mecanismo de submit.
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
// depois que `decodificarRedimensionada`, abaixo, parou de decodificar em
// resolução nativa antes de reduzir) mantém nitidez de sobra pra
// evidência/documentação e ainda reduz o arquivo pra uma fração do
// tamanho original — só reduz, nunca aumenta foto já pequena.
const MAX_DIMENSAO_PX = 2560;

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a foto."));
    };
    img.src = url;
  });
}

// Bug real relatado pelo usuário (15/09/2026): "insuficiência de memória"
// ao subir foto no celular. Causa — `carregarImagem` (acima) decodifica a
// foto na resolução NATIVA da câmera antes de desenhar no canvas: uma foto
// de 48MP decodificada crua ocupa ~48_000_000 × 4 bytes ≈ 180MB só o
// buffer de pixels, e isso acontece ANTES de qualquer redimensionamento —
// aumentar `MAX_DIMENSAO_PX` nunca ajudaria aqui, porque o estouro já
// aconteceu na hora de decodificar, não na hora de desenhar.
//
// `createImageBitmap` com `resizeWidth`/`resizeHeight` deixa o PRÓPRIO
// decodificador do navegador já produzir a imagem no tamanho final
// (equivalente ao `inSampleSize` do Android) — o pico de memória nunca
// passa pelo tamanho nativo. A spec NÃO preserva a proporção quando os
// dois lados são dados ao mesmo tempo, então o primeiro passe (barato: o
// decodificador já subamostra pro tamanho pedido, sem decodificar em
// resolução nativa) usa só `resizeWidth` — isso também serve pra descobrir
// a proporção real (já com a orientação EXIF aplicada via
// `imageOrientation: "from-image"`, que também corrige uma foto retrato
// aparecendo deitada, problema que a versão anterior nunca tratava
// explicitamente). Se o resultado já cabe nos dois lados (paisagem ou
// quadrada), é só isso — 1 decodificação só. Numa foto retrato, a altura
// ainda passa do teto depois desse primeiro passe (só a largura foi
// limitada) — um segundo passe com os dois lados já calculados certos
// resolve, e mesmo esse segundo passe nunca decodifica em resolução
// nativa (o primeiro já produziu um bitmap pequeno, é dele que o segundo
// parte).
//
// Nem todo navegador aceita as opções de resize (Safari mais antigo,
// principalmente) — nesse caso cai pro caminho antigo (`<img>` + canvas na
// resolução nativa), que é exatamente o comportamento de antes desta
// correção: sem regressão pra quem já funcionava, só melhoria pra quem
// tinha esse travamento.
async function decodificarRedimensionada(file: File): Promise<ImageBitmap> {
  const opcoesBase = { imageOrientation: "from-image" as const, resizeQuality: "medium" as const };
  const passe1 = await createImageBitmap(file, { ...opcoesBase, resizeWidth: MAX_DIMENSAO_PX });
  if (passe1.height <= MAX_DIMENSAO_PX) return passe1;

  const alvoLargura = Math.round(MAX_DIMENSAO_PX * (passe1.width / passe1.height));
  passe1.close();
  return createImageBitmap(file, { ...opcoesBase, resizeWidth: alvoLargura, resizeHeight: MAX_DIMENSAO_PX });
}

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
      bitmap = await decodificarRedimensionada(file);
      largura = bitmap.width;
      altura = bitmap.height;
    } catch {
      // Navegador sem suporte a `resizeWidth`/`resizeHeight` (ou outra
      // falha de decodificação) — cai pro caminho antigo, que redimensiona
      // DEPOIS de decodificar em resolução nativa (mesmo risco de memória
      // de antes desta correção, mas nunca pior do que já era).
      const img = await carregarImagem(file);
      const escala = Math.min(1, MAX_DIMENSAO_PX / Math.max(img.naturalWidth, img.naturalHeight));
      largura = Math.round(img.naturalWidth * escala);
      altura = Math.round(img.naturalHeight * escala);
      bitmap = img;
    }
  } else {
    const img = await carregarImagem(file);
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

export function CameraCaptureField({ name, label, onReadyChange }: Props) {
  const uid = useId();
  const inputId = `${uid}-picker`;
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

      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="text-sm text-text-secondary file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
      />

      {/* Input oculto que de fato viaja no FormData — recebe o arquivo já
          carimbado via DataTransfer, nunca o arquivo original escolhido. */}
      <input ref={hiddenFileRef} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden="true" />
      <input type="hidden" name={`${name}Lat`} value={lat} />
      <input type="hidden" name={`${name}Lng`} value={lng} />

      {status === "processando" && <p className="text-xs text-text-tertiary">Processando foto...</p>}
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
