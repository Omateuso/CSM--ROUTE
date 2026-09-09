# Referências

Material de **origem** — nada aqui é lido pelo app em tempo de execução. São os
arquivos que serviram de base pra algo que já existe no código, guardados pra
quando for preciso refazer ou conferir a procedência.

Se você está procurando o que o app usa de verdade, é `public/` (assets
servidos) e `lib/` (código).

| Arquivo | O que é | Virou o quê no projeto |
|---|---|---|
| `marca-igedes-original.png` | Logo da iGEDES como o marketing mandou (ícone de pétalas, margem transparente sobrando) | Recortado com `sharp` → `public/logo-igedes.png`, usado na tela de login |
| `timbrado-igedes.docx` | Timbrado oficial do relatório. O `word/media/image1.png` dentro dele é uma arte única cobrindo a página A4 inteira | Cores amostradas pixel a pixel (teal `#008A83`, vermelho `#D22B1C`) e recortes → `public/relatorio/*.png`, usados no PDF do relatório |
| `menu-pasta-referencia.zip` | `menu-pasta-ospower.html` + o prompt que o acompanhava — referência visual do menu em formato de pasta | Portado para `app/app-nav.tsx` + `app/app-nav.module.css` |
| `capa-relatorio-design.zip` | Capa de relatório desenhada à parte (export de canvas: `.dc.html` + imagens) | **Não implementado** — ideia guardada, não virou código |
| `base-automatizacao/` | Base em Python que já falava com o TomTicket (console + API), escrita antes deste projeto | Serviu de referência para `lib/tomticket/` — limitador de 3 req/s, política de retry e a armadilha da leitura incremental vieram dela |

## Uma ressalva sobre a `base-automatizacao`

Ela **não roda** como parte deste sistema e tem pelo menos um erro conhecido: o
módulo `base/tomticket_api.py` chama `/ticket/detail` com o parâmetro `id`, mas
a documentação oficial diz `ticket_id` — o próprio README dela admite que
aquele módulo nunca foi exercitado contra uma conta real. A implementação
correta está em `lib/tomticket/client.ts`. Consulte a base pelo raciocínio, não
copie o código dela.

## Marca em vetor

`marca-igedes-original.png` é raster. Já foi pedido ao marketing o logo em
vetor isolado — quando chegar, é só substituir os PNGs em `public/`.
