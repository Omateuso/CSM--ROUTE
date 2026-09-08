// Limites e endereços da API v2.0 do TomTicket, num lugar só.
//
// Todos vêm da documentação oficial (tomticket.tomticket.com/kb/api) — não são
// chutes nem valores "com folga". Centralizados aqui porque três módulos
// diferentes precisam deles: o cliente HTTP, a montagem de anexos e a UI (que
// mostra o contador de caracteres antes de deixar enviar).

export const TOMTICKET_API_BASE = "https://api.tomticket.com/v2.0";

// `message` em POST /ticket/reply/operator. Com o texto padrão (154 bytes)
// sobrava folga; desde que o gerente pode escrever a própria mensagem, esse
// limite passou a ser alcançável de verdade.
export const TOMTICKET_MAX_MENSAGEM = 512;

// Teto da requisição INTEIRA (mensagem + todos os anexos), não por arquivo.
export const TOMTICKET_MAX_REQUISICAO_BYTES = 25 * 1024 * 1024;

export const TOMTICKET_MAX_ANEXOS = 25;

// O teto documentado. Estourar não devolve erro: o TomTicket enfileira, e a
// lentidão aparece sem explicação nenhuma — o pior tipo de problema pra
// diagnosticar depois. Por isso o limitador é obrigatório, não opcional.
export const TOMTICKET_REQ_POR_SEGUNDO = 3;

export function tomticketToken(): string | null {
  const token = process.env.TOMTICKET_TOKEN?.trim();
  return token ? token : null;
}

// A UI usa isto pra desabilitar o botão com uma explicação em vez de deixar o
// gerente clicar e receber um erro cru vindo do servidor.
export function tomticketConfigurado(): boolean {
  return tomticketToken() !== null;
}
