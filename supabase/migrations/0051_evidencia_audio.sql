-- =============================================================================
-- Áudio do relato do técnico (pedido do usuário, 15/09/2026)
--
-- "Coloque áudio + transcrição, ao invés de só transcrição, quando o técnico
-- for relatar o que foi feito no atendimento/revisão" — o campo de texto
-- (`observacao`/`descricao`) continua obrigatório e é o que a validação do
-- banco checa (fn_concluir_servico/fn_revisar_servico não mudam, nenhuma
-- delas passa a exigir áudio — é um reforço opcional, não um novo portão).
-- Quando o técnico usa o botão "Falar" (lib/ui/campo-transcricao.tsx), a
-- gravação em si também é salva como evidência, ao lado da foto/OS.
--
-- `tipo_evidencia` é enum de verdade (0001) — ADD VALUE precisa vir sozinho
-- na migration (Postgres não deixa usar o valor novo na MESMA transação em
-- que ele foi criado). Como o resto desta migration (bucket) não referencia
-- 'audio' em nenhuma expressão SQL, os dois cabem no mesmo arquivo sem
-- problema — só uma função/policy que tentasse comparar contra 'audio'
-- precisaria ir numa migration separada, e nenhuma precisa aqui.
-- =============================================================================

alter type tipo_evidencia add value 'audio';

-- Formatos que o MediaRecorder do navegador realmente produz: webm/opus é o
-- padrão em Chrome/Edge/Firefox (o SO mais provável do técnico em campo,
-- Android); mp4/aac é o padrão do Safari/iOS. Mesmo padrão de
-- `on conflict (id) do update` que a 0014 já usa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  10485760,
  array[
    'image/jpeg','image/png','image/webp','image/heic','application/pdf',
    'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac'
  ]
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
