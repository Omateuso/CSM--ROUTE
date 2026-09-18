// Extração de protocolos de um texto colado (pedido do usuário, 17/09/2026):
// o gerente cola a mensagem crua do WhatsApp na barra de registro e o sistema
// pesca os chamados, ignorando todo o resto (saudação, carimbo de hora, nome
// de quem mandou, "eles são urgentes").
//
// Formato real que precisa aguentar, dos exemplos que o usuário mandou:
//
//   [17:37, 17/09/2026] pedro: Boa tarde,
//   Peço atenção aos chamados, por gentileza:
//   #332633 - Fechadura RT 93
//   333737 - Bica da pia da cozinha está vazanda e não fecha RT Fabio Luz
//   ... aproveitando a ida da equipe ao território.  334695 - Descarga sem pressão
//
// Ou seja: protocolo com ou sem "#", no começo OU no meio da linha, e a mesma
// mensagem colada duas vezes (protocolos repetidos).
//
// POR QUE EXATAMENTE 6 DÍGITOS: é o formato real do protocolo do TomTicket
// neste projeto (conferido na base: de 251133 a 334695; os fictícios de teste
// são 9000xx, também 6). Aceitar 5+ pegaria pedaço de CEP ("20730-030" →
// "20730") e aceitar 4+ pegaria ano de data ("17/09/2026" → "2026"). Com 6
// exatos, carimbo de hora (17:37), data e CEP passam batido sozinhos, sem
// precisar de nenhuma regra especial pra cada um.

/** Um protocolo pescado do texto + o que veio escrito depois dele na mesma linha. */
export type ItemColado = {
  protocolo: string;
  /** Texto que seguia o protocolo ("- Fechadura RT 93" → "Fechadura RT 93"). Vazio quando só veio o número. */
  motivo: string;
};

export type ExtracaoColagem = {
  itens: ItemColado[];
  /** Linhas com algum conteúdo mas nenhum protocolo — ruído descartado (saudação, assinatura...). */
  linhasIgnoradas: number;
  /** Protocolos que apareceram mais de uma vez (mensagem colada em duplicata). Só o primeiro vale. */
  repetidos: number;
};

const PROTOCOLO = /#?\b(\d{6})\b/g;

/** Tira separador de abertura ("- ", ": ", "– ") e espaço sobrando das pontas. */
function limparMotivo(texto: string): string {
  return texto
    .replace(/^[\s\-–—:·.,)\]]+/, "")
    .replace(/[\s\-–—:·,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extrairProtocolos(texto: string): ExtracaoColagem {
  const itens: ItemColado[] = [];
  const vistos = new Set<string>();
  let linhasIgnoradas = 0;
  let repetidos = 0;

  for (const linha of texto.split(/\r?\n/)) {
    if (linha.trim() === "") continue;

    // Todas as ocorrências da linha, pra saber onde cada motivo termina: o
    // texto de um protocolo vai até o começo do PRÓXIMO protocolo, não até o
    // fim da linha — assim "334695 - Descarga ... 333553 - Reparo ..." numa
    // linha só não mistura os dois motivos.
    const achados = [...linha.matchAll(PROTOCOLO)];
    if (achados.length === 0) {
      linhasIgnoradas += 1;
      continue;
    }

    achados.forEach((achado, i) => {
      const protocolo = achado[1];
      const inicioDoTexto = (achado.index ?? 0) + achado[0].length;
      const fimDoTexto = i + 1 < achados.length ? (achados[i + 1].index ?? linha.length) : linha.length;
      const motivo = limparMotivo(linha.slice(inicioDoTexto, fimDoTexto));

      if (vistos.has(protocolo)) {
        repetidos += 1;
        return;
      }
      vistos.add(protocolo);
      itens.push({ protocolo, motivo });
    });
  }

  return { itens, linhasIgnoradas, repetidos };
}
