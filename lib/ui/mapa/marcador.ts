import L from "leaflet";

// Os 3 mapas do sistema desenham o mesmo marcador: um círculo colorido com
// borda branca e, às vezes, um número dentro (total de chamados ou a ordem
// na rota). No Google isso era HTML dentro de <AdvancedMarker>; no Leaflet
// é um L.divIcon, que também recebe HTML — o visual final é o mesmo.
//
// O anel pulsante do nível "crítico" reaproveita o @keyframes marker-pulse
// que já existe em app/globals.css desde o mapa operacional da Fase 1.

export type EspecMarcador = {
  cor: string;
  tamanho: number;
  conteudo?: string | number;
  opacidade?: number;
  pulsa?: boolean;
  /** Espessura da borda branca (o pin do técnico usa 3, o resto 2). */
  borda?: number;
  /** Halo colorido ao redor — o pin do técnico na Rota do dia. */
  halo?: string;
};

function escapar(valor: string | number): string {
  return String(valor).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function criarIcone({
  cor,
  tamanho,
  conteudo,
  opacidade = 1,
  pulsa = false,
  borda = 2,
  halo,
}: EspecMarcador): L.DivIcon {
  const texto = conteudo === undefined || conteudo === "" ? "" : escapar(conteudo);
  const anel = pulsa
    ? `<span style="position:absolute;width:${tamanho + 16}px;height:${tamanho + 16}px;left:${-8}px;top:${-8}px;border-radius:9999px;background:${cor};opacity:.6;animation:marker-pulse 1.8s ease-out infinite" aria-hidden="true"></span>`
    : "";

  // O wrapper precisa do tamanho exato do círculo pra a âncora central
  // bater com a coordenada real; o anel fica fora do fluxo (position
  // absolute), então não desloca nada.
  const html =
    `<div style="position:relative;width:${tamanho}px;height:${tamanho}px;opacity:${opacidade}">` +
    anel +
    `<div style="position:relative;display:flex;align-items:center;justify-content:center;` +
    `width:${tamanho}px;height:${tamanho}px;border-radius:9999px;background:${cor};` +
    `border:${borda}px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)${halo ? `,0 0 0 4px ${halo}` : ""};` +
    `color:#fff;font-size:10px;font-weight:600;line-height:1">${texto}</div></div>`;

  return L.divIcon({
    html,
    className: "", // sem a classe padrão do Leaflet (que desenha fundo branco)
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    popupAnchor: [0, -tamanho / 2],
  });
}
