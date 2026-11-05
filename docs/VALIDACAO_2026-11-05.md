# Validação independente do Alfred Avatar Studio — 05/11/2026

## Resultado

Validação parcial: dependências instaladas, 83 testes originais aprovados e build aprovado. Não foi possível validar a interface em navegador. A arquitetura e o código de produção não foram alterados. Na etapa inicial de auditoria não houve commit, push ou merge. Este relatório e as reproduções foram posteriormente preparados para revisão em PR; não há correções no código de produção.

## Atualização para abertura do PR

A `main` avançou para `f48ae9f20acdc4f95afcaf2a4199e0aa8e61b4e1` e agora contém a implementação. Portanto, o achado de ausência de código na branch principal abaixo é **histórico e resolvido**, referente ao snapshot inicial `6c16197`. O PR parte da nova main. A versão do package.json continua 0.1.0.

Revalidação na base atual do PR: `npm test` aprovou **87/87 testes em 10 arquivos** (84 existentes + 3 reproduções) e `npm run build` passou. Bundle JS: 340,10 kB (gzip 107,62 kB). A interface no navegador não foi revalidada nesta etapa.

Os testes adicionais caracterizam comportamentos observados; passar nesses testes não significa que os defeitos foram corrigidos. Quando houver correções, suas expectativas deverão ser alteradas para o comportamento desejado.

## Revisões efetivamente examinadas

- `main`: `6c161978b751d49ae9703f0c1f3615ca2408e765`. Sua árvore contém somente `README.md` e `PRD.md`. Não contém aplicação, package.json ou testes.
- Implementação encontrada em `feat/fases-1-3`: `42378d1169e4a2f6fd66aebfacb4c2c32025121e`. Checkout separado em HEAD destacado para auditoria.
- Nessa implementação, package.json declara **0.1.0**, e README/PRD indicam **PRD v1.4**. A premissa de versão 0.1.1 e PRD em `docs/PRD.md` não corresponde às revisões verificadas. O PRD está na raiz.
- O contrato de tipos possui 12 estados operacionais e 11 emoções (neutra + dez emoções), além de estados extras em relação aos nove estados fundamentais.

## Execuções nesta auditoria

Ambiente: Linux, Node.js v24.22.1 e npm 11.9.0. Isso não comprova desempenho ou compatibilidade Safari/macOS no MacBook Air M3.

| Procedimento | Resultado observado |
|---|---|
| `npm ci --ignore-scripts --fetch-retries=0 --fetch-timeout=20000` | 102 pacotes instalados. Scripts de instalação não executados; o build subsequente funcionou. |
| `npm test` antes de adicionar reproduções | 83/83 testes, 9/9 arquivos aprovados. |
| `npm run build` | TypeScript e Vite aprovados; JS 339,31 kB, gzip 107,29 kB; CSS 24,38 kB, gzip 5,57 kB. |
| `npm run preview` + GET local | HTML de produção servido em 127.0.0.1:4173, com referências ao JS e CSS gerados. Não equivale a executar o React/Canvas. |
| `npx playwright test --project=chromium --grep @smoke` | 6 testes interrompidos na inicialização: executável Chromium ausente. Nenhuma asserção de interface validada. |
| `npx playwright install chromium webkit` | Falhou ao baixar Chromium: arquivo inválido/truncado, erro de assinatura do diretório ZIP. WebKit não chegou a ser instalado. |
| Abrir prévia pelo navegador disponível | `net::ERR_CONNECTION_REFUSED`; não foi possível inspecionar visualmente a página. |
| `npx vitest run src/test/validation-audit.test.ts` | 3/3 reproduções aprovadas. Confirmam os comportamentos abaixo, não a correção deles. |

Os números de Playwright registrados em docs/PLANO_E2E.md são evidências de outra execução. Não foram reproduzidos nem incorporados como resultados desta auditoria.

## Achados reproduzíveis e revisão estática

### Alta — publicação principal sem implementação (resolvido após a auditoria inicial)

Reprodução: consultar a árvore recursiva do commit da main acima. Existem apenas dois arquivos. Clonar a branch padrão não fornece o simulador e não permite npm test/build. A implementação está em outra branch e sua versão declarada é 0.1.0. É necessário alinhar branch de entrega, versão e instruções de execução antes de apresentar a versão como disponível na main.

### Média — coordenada lógica fora do contrato aceita

`src/input/coords.ts`, clientToLogical, transforma o ponto de cliente (240,120), num canvas CSS 240×240 com origem (0,0), em (240,120). `CircularContactFilter` aceita esse ponto porque a circunferência usa <= 120². O PRD §5.1 define coordenadas 0..239. A função clampLogical existe, mas não é aplicada nesse caminho.

Reproduzido no primeiro teste adicional. Corrigir a convenção de borda/normalização, preservando o teste circular sobre coordenadas não truncadas para não transformar contatos externos em contatos válidos.

### Média — defaults importados não atualizam a sessão ativa

Importar JSON válido com runtime.defaultState=sleep e runtime.defaultEmotion=sad grava esses valores no projeto, mas o Simulator já existente continua em idle/neutral. A inicialização em main.tsx aplica defaults apenas na primeira carga. A sincronização em App.tsx acompanha áudio e animação selecionada, sem reaplicar defaults na ativação/importação de projeto.

Reproduzido no terceiro teste adicional. Impacto: o mesmo projeto pode apresentar comportamento diferente logo após importação e após recarga. Convém definir e implementar uma política explícita ao ativar um projeto, incluindo cancelamento de cenários anteriores.

### Média — seleção atual de emoção não é salva/exportada

Selecionar sad com intensidade 0,35 altera Simulator, mas exportJson mantém runtime.defaultEmotion=neutral. EmotionPanel chama somente sim.setEmotion; a intensidade ativa também não integra o projeto exportado. Reproduzido no segundo teste adicional.

O JSON preserva a configuração armazenada, mas não toda a sessão visível. Se a emoção atual for intencionalmente temporária, a interface e a documentação precisam distinguir prévia transitória de configuração salva; se deve compor o avatar salvo, falta persistir essa seleção. Não foi presumido que estados operacionais transitórios deveriam ser salvos.

### Média — barra de espaço captura botões da interface

Achado estático, sem reprodução em navegador: useHardwareShortcut em App.tsx exclui INPUT/TEXTAREA/SELECT/contenteditable, mas não BUTTON nem elementos role=button. O listener global chama preventDefault para Space. Assim, há risco concreto de bloquear a ativação padrão por teclado de botões como exportar ou cancelar, iniciando Push-to-Talk. Também há um caminho em que pressionar B fora de campo, mover o foco para INPUT e soltar B ignora o keyup e mantém pttDown até outro evento de liberação/blur. Validar ambos no navegador antes de declarar acessibilidade por teclado aprovada.

### Baixa — representação das pernas diverge do PRD

O PRD §4.1 descreve tripé. RobotBody em DeviceViewport.tsx desenha quatro pés e comenta explicitamente “Quatro pés”. É uma inconsistência documental/visual confirmada no código, sem conclusão sobre a geometria da unidade comprada. Alinhar a referência visual adotada e manter sua fidelidade física como pendente.

### Alta — garantias de hardware excedem as evidências

PRD §3.4 afirma que a prévia mostra cores “exatamente” como no LCD; §16 garante que exportações estarão prontas para o primeiro dia. Quantização RGB565 apenas aproxima a discretização de cor: não verifica gama, brilho, orientação, painel, firmware ou compatibilidade do player. Essas promessas conflitam com as ressalvas de validação em bancada do próprio PRD. README lista firmwares compatíveis sem teste na unidade. Tratar como alvos de integração até comprovação.

## Implementado, simulado e testado

| Área | Código encontrado | Evidência desta execução | Limite |
|---|---|---|---|
| Estados e conversas | Máquina de estados e cenários temporizados; cancelamento e PTT | Testes originais aprovados, inclusive sequência idle/wake/listening/thinking/speaking/idle e cancelamento sem eventos atrasados | Não é conversa com IA, ASR ou TTS real; interface não inspecionada |
| Animação e emoções | Canvas 2D, composição de poses, keyframes, interpolação, piscadas com semente | Lógica de interpolação, composição e reprodução aprovada nos testes originais | Canvas, aparência final, FPS e fluidez não medidos |
| Persistência | IndexedDB via idb, autosave, fallback em memória e JSON | Testes com fake-indexeddb aprovados para recuperação entre stores, CRUD e importação | Não houve reload real de navegador, teste de quota ou fechamento abrupto |
| Toques e botão | Coordenadas, filtro circular, gestos, PTT | Testes originais de lógica aprovados; borda 240 reproduzida adicionalmente | Pointer capture, DPI, teclado e escalas reais não validados |
| Exportação | PNG, ESPHome, spritesheet, MJPEG e C/LVGL | Funções puras de formatos cobertas pela suíte original | Downloads reais, rasterização, compilação C/LVGL e reprodução no dispositivo não testados |
| Som | Web Audio com sinais sintéticos | Teste de registro de cues com ganho zero no modo mudo | Nenhuma escuta ou sincronização audiovisual comprovada |
| Offline | Arquitetura local e Vite em loopback | Build e resposta HTTP local comprovados | Teste de requisições externas bloqueadas não executou |

## Verificações ainda necessárias

No ambiente com navegador instalado: executar `npx playwright install chromium webkit`, `npm run test:e2e:smoke` e `npm run test:e2e`; conferir a interface de produção via npm run preview. Reproduzir os achados de teclado e defaults, percorrer todos os estados/emoções, medir 15/30 FPS e consumo no Mac M3, alternar aba, testar recarga real após autosave, importar/exportar JSON e baixar os formatos gráficos. Não atualizar snapshots para encobrir diferenças sem revisar a imagem.

Até o hardware chegar: permanecem sem validação firmware original, revisão efetiva da placa, controlador LCD/touch da unidade, GPIOs, áudio, presença de bateria, espelhamento/ordem de bytes, capacidade e desempenho reais, suporte do player SD a MJPEG e integração XiaoZhi/ESPHome. Nenhum desses pontos pode ser certificado pelo build web.

Armadilhas registradas: confundir main com branch de implementação; confundir versão do PRD com versão do aplicativo; contar falha de lançamento do navegador como defeito do produto; considerar fake-indexeddb equivalente a reload real; confundir quantização RGB565 com fidelidade física; interpretar testes que reproduzem falhas como aprovação funcional.
