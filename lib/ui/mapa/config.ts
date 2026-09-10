// Ponto ÚNICO de troca do provedor de tiles.
//
// O padrão é o tile do OpenStreetMap: gratuito e sem chave, mas a política
// oficial deles é explícita — não há SLA, o acesso a uso comercial pode ser
// retirado a qualquer momento, e quem faz uso pesado deve hospedar os
// próprios tiles. Para o volume daqui (poucos gerentes) é aceitável, e a
// atribuição visível abaixo é obrigatória.
//
// Quando isso deixar de servir (uso crescer, ou na migração pro servidor
// interno), troque as duas variáveis de ambiente e nada mais no código
// precisa mudar — nenhum componente conhece a URL do tile.
export const TILES_URL =
  process.env.NEXT_PUBLIC_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILES_ATRIBUICAO =
  process.env.NEXT_PUBLIC_TILES_ATRIBUICAO ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Rio de Janeiro — mesmo centro/zoom que os mapas usavam no Google.
export const CENTRO_PADRAO = { lat: -22.9068, lng: -43.1729 };
export const ZOOM_PADRAO = 11;
