# PRD e prompt de implementação | Alfred Avatar Studio

**Versão do documento:** 1.4  
**Data:** 05/11/2026  
**Status:** Especificação atualizada com hardware identificado (Spotpear Ball V2 / XiaoZhi AI Robot Ball); compatibilidade física condicionada a validação final pós-recebimento  
**Nome do produto:** Alfred Avatar Studio  
**Nome do assistente:** Alfred  
**Nome sugerido para o repositório:** `alfred-avatar-studio`  
**Plataforma principal:** macOS Apple Silicon, via navegador local  
**Computador de referência:** MacBook Air M3 com 8 GB de RAM  
**Hardware-alvo identificado:** Spotpear Ball V2 / XiaoZhi AI Voice Chat Robot Ball ESP32-S3 N16R8 (AliExpress item [1005008627679270](https://www.aliexpress.com/item/1005008627679270.html))  
**Idioma da interface e da documentação:** Português brasileiro  

---

## 1. Missão e instruções de execução

Implemente o **Alfred Avatar Studio**, uma aplicação local para criar, editar, animar, simular e preparar avatares destinados ao assistente físico Alfred, baseado no dispositivo comercial **Spotpear Ball V2** (comercializado como XiaoZhi AI Voice Chat Robot Ball / DeepSeek Chat Robot).

Execute as **fases 1 a 3** descritas neste documento. As fases 4 e 5 constituem o planejamento da integração física e permanecem condicionadas ao recebimento, à inspeção e à validação em bancada do equipamento real.

Assuma as decisões técnicas necessárias dentro deste escopo. Priorize simplicidade, manutenção, baixo consumo de recursos e compatibilidade com o computador de referência. Não transfira ao usuário escolhas de bibliotecas, organização de código ou estratégias de implementação.

Antes de alterar o projeto:

1. Verifique se existe código no ambiente de trabalho e leia as instruções aplicáveis do repositório.
2. Identifique o que já foi implementado, o que está incompleto e o que diverge desta especificação.
3. Preserve alterações existentes e componentes adequados. Não reescreva o projeto integralmente sem necessidade demonstrável.
4. Confira a documentação das dependências utilizadas, preferindo Context7 quando disponível e as fontes oficiais.
5. Organize a implementação por entregas verificáveis, sem limitar o trabalho à produção de um plano.

Não amplie o escopo para serviços de IA na nuvem, reconhecimento de voz real, aplicativos nativos compilados ou funcionalidades P2 durante as fases 1 a 3.

Se alguma verificação não puder ser executada no ambiente disponível, registre a limitação e o procedimento necessário para completá-la. Não apresente resultados presumidos como testes realizados.

---

## 2. Visão do produto

O Alfred Avatar Studio permitirá desenvolver a aparência, as expressões e o comportamento visual do assistente antes da chegada do dispositivo.

A experiência deverá lembrar um simulador visual de dispositivo: o usuário vê o robô físico em formato esférico, modifica os traços de seu rosto, experimenta emoções, reproduz conversas e estados simulados, ouve sons de feedback sintéticos e testa interações diretamente na tela circular de 240 × 240 ou no botão físico simulado.

O produto será um **simulador de aparência, eventos e comportamento**, sem pretensão de emular o microcontrolador, a pilha TCP/IP ou o desempenho do ESP32-S3.

### 2.1. Estado de conhecimento do hardware e restrições

O dispositivo foi adquirido no AliExpress (item [1005008627679270](https://www.aliexpress.com/item/1005008627679270.html)), mas ainda se encontra em trânsito.

A partir da análise dos anúncios comerciais e da investigação técnica no repositório oficial da XiaoZhi (`78/xiaozhi-esp32`) e no projeto comunitário `RealDeco/xiaozhi-esphome`, foi possível **identificar a variante exata do hardware**:
- Trata-se da revisão **Spotpear Ball V2** (SKU de firmware: `sp-esp32-s3-1.28-box`).
- O hardware conta com processador ESP32-S3 (16 MB Flash, 8 MB PSRAM), display circular GC9A01 de 1,28", controlador de toque CST816D, codec de áudio ES8311, botão físico Boot no GPIO 0, LED RGB WS2812 no GPIO 48, slot MicroSD para reprodução de mídia local (MJPEG/MP3) e pernas de tripé removíveis.

No entanto, as seguintes **restrições fundamentais** permanecem em vigor:

- Não existe acesso físico à unidade adquirida até sua entrega.
- Nenhum firmware foi extraído diretamente da unidade física.
- A presença efetiva do módulo de bateria ou do sensor de toque capacitivo na unidade despachada depende do lote/variação comprada e só poderá ser atestada no recebimento.
- A aplicação no navegador é uma ferramenta de autoria e simulação; a integração física só será declarada funcional após testes de bancada no equipamento real.

O desenvolvimento das fases 1 a 3 deve avançar com base nos parâmetros mapeados, mantendo o simulador flexível e orientado a dados.

### 2.2. Objetivos

1. Representar a tela circular na resolução nativa de 240 × 240 pixels.
2. Apresentar o avatar aplicado a uma representação visual vetorial fiel do robô esférico, com opção de pernas removíveis e guias de corte circular (*safe area*).
3. Permitir personalizar o rosto (olhos, boca, sobrancelhas, cores) sem editar código.
4. Produzir expressões, emoções, animações e transições fluidas.
5. Simular estados de conversação, execução de tarefas, conectividade e bateria.
6. Simular acionamento por botão físico e gestos de toque de ponto único.
7. Emitir feedback sonoro sintético local (beeps e tons de estado via Web Audio API).
8. Salvar, recuperar, importar e exportar projetos completos em JSON.
9. Exportar recursos gráficos nos formatos-chave para o hardware: PNG, Spritesheet, pacote de estados para ESPHome, sequências/MJPEG para cartão SD e arrays C para LVGL.
10. Preparar contratos de dados e eventos que orientem a integração física nas fases 4 e 5.

### 2.3. Fora do escopo das fases 1 a 3

- Emulação de instruções do ESP32-S3 ou execução de binários compilados em C/C++.
- Gravação direta de firmware via WebSerial / WebUSB (reservada à Fase 4/5).
- Reconhecimento de fala real (ASR), síntese de voz neural (TTS) ou chamadas obrigatórias a LLMs externos.
- Sincronização labial baseada em análise espectral de áudio real.
- Suporte a múltiplos pontos de toque simultâneos (hardware CST816 opera em ponto único).
- Modelagem 3D pesada (WebGL/Three.js).
- Contas de usuário na nuvem, banco de dados remoto ou telemetria.

---

## 3. Hardware e perfil de simulação

### 3.1. Especificações técnicas identificadas (Spotpear Ball V2)

A tabela abaixo consolida as especificações identificadas nos repositórios oficiais e anúncios comerciais:

| Característica | Especificação Técnica Mapeada | Detalhe de Implementação |
|---|---|---|
| **Placa / Modelo** | Spotpear Ball V2 (`sp-esp32-s3-1.28-box`) | Revisão comercial com pernas removíveis e slot SD |
| **Microcontrolador** | Espressif ESP32-S3 (N16R8) | Dual-Core Xtensa LX7 @ 240 MHz |
| **Memória Flash** | 16 MB (Quad/Octal SPI) | Partição para firmware, assets e NVS |
| **Memória PSRAM** | 8 MB Octal PSRAM (AP 3v3 @ 80 MHz) | Memória estendida para buffers gráficos e áudio |
| **Display** | LCD circular IPS de 1,28 polegada | Resolução 240 × 240 pixels, 262K cores, ângulo de 170° |
| **Controlador do Display** | **GC9A01** (interface SPI @ 40 MHz) | `MOSI: GPIO 2`, `SCLK: GPIO 4`, `CS: GPIO 5`, `DC: GPIO 47`, `RST: GPIO 38`, `Backlight: GPIO 42` |
| **Controlador de Toque** | **CST816 / CST816D** (I²C) | `SDA: GPIO 11`, `SCL: GPIO 7`, `RST: GPIO 6`, `INT: GPIO 12` |
| **Codec de Áudio** | **Everest ES8311** (I²S + I²C @ `0x18`) | `MCLK: 16`, `WS: 45`, `BCLK: 9`, `DIN: 10`, `DOUT: 8`, `PA: 46`, `SDA: 15`, `SCL: 14` |
| **Botão Físico** | Botão Boot / Action | `GPIO 0` (ativo em nível baixo) |
| **LED Integrado** | LED RGB endereçável (WS2812) | `GPIO 48` |
| **Monitoramento de Bateria** | ADC de Tensão e Detecção de Carga | `ADC Tensão: GPIO 1`, `Status Carga: GPIO 41` |
| **Armazenamento Local** | Slot MicroSD (TF Card) | Suporte nativo a reprodução de vídeo MJPEG e áudio MP3 |
| **Conectividade** | Wi-Fi 2,4 GHz (802.11 b/g/n) + BLE 5.0 | Antena integrada na placa |
| **Alimentação** | USB Type-C (5V) | Suporte a carregamento de bateria LiPo interna (se instalada) |

### 3.2. Informações pendentes de validação física (Fase 4)

Mesmo com a arquitetura mapeada, os seguintes aspectos da unidade física recebida deverão ser confirmados:

1. Se a unidade específica despachada possui o módulo de bateria recarregável instalado ou apenas a preparação no circuito.
2. Se a unidade conta com a membrana touch CST816 montada sobre o display (algumas variantes econômicas são montadas sem touch).
3. A versão do firmware original pré-instalada (XiaoZhi AI 1.x ou 2.x).
4. A taxa de transferência e a compatibilidade do leitor MicroSD com cartões de alta velocidade (FAT32/exFAT).

### 3.3. Perfil de simulação: `XIAOZHI_ROBOT_BALL_128`

A aplicação utilizará o perfil inicial `XIAOZHI_ROBOT_BALL_128`:

| Propriedade | Valor inicial |
|---|---|
| Identificador do Perfil | `XIAOZHI_ROBOT_BALL_128` |
| Resolução lógica | 240 × 240 |
| Formato visível | Círculo perfeito inscrito (`raio = 120 px`) |
| Cor de fundo padrão | Preto (`#000000`) |
| Orientação de tela | Sem rotação (`mirror_x = true`, `mirror_y = false`) |
| Formato de referência para memória | RGB565 (16 bits/pixel) |
| Frequência-alvo do simulador | 30 FPS (com opção de 15 FPS para economia de bateria) |
| Entrada interativa | Ponto único de contato (Pointer Events normalizados) |
| Entrada física simulada | Botão Push-to-Talk (Boot - GPIO 0) |
| Guia de Área Segura (*Safe Area*) | Círculo de segurança com margem de 8 pixels lógicos |

### 3.4. Fidelidade da prévia e quantização RGB565

- O Canvas do navegador renderiza nativamente em RGBA de 32 bits (8 bits por canal).
- Para manter a fidelidade com o display GC9A01 do hardware, o estúdio oferecerá uma opção de **Prévia RGB565**:
  - Trata-se de um filtro em tempo real que quantiza as cores (5 bits para Vermelho, 6 bits para Verde, 5 bits para Azul).
  - Permite ao designer visualizar gradações de cor e bandas de posterização exatamente como aparecerão no display físico.
  - A quantização é um recurso de visualização da prévia e não impede a exportação em PNG padrão de 32 bits ou em C Array RGB565.

---

## 4. Experiência do usuário

A interface será dividida em cinco áreas funcionais integradas:

1. **Visualização do dispositivo:** Prévia interativa nos modos Robô, Display e Pixel.
2. **Editor de avatar:** Ajuste paramétrico de feições, olhos, boca, sobrancelhas e paletas.
3. **Editor de animações:** Linha do tempo, quadros-chave e curvas de interpolação.
4. **Simulador de conversação:** Cenários pré-programados de diálogo, eventos de sistema e feedback sonoro.
5. **Simulador de interação física:** Toque na tela (CST816) e acionamento por botão físico (GPIO 0).

Recursos transversais: Gerenciador de projetos (IndexedDB), diagnósticos em tempo real e exportador multiformato.

### 4.1. Visualização do dispositivo

A visualização do robô será realizada via **gráfico vetorial 2D (SVG) de alta fidelidade**, integrado ao Canvas da tela circular.

Elementos da representação vetorial:
- Corpo esférico branco com acabamento fosco e sombreamento suave.
- Moldura frontal circular preta.
- Display central de 240 × 240 pixels.
- **Pés/pernas de tripé inferiores removíveis:** Opção de alternar na interface entre `Com Pernas` (modo tripé de mesa) e `Sem Pernas` (modo esfera pura / bola), refletindo a "New Version" do hardware.
- **Botão físico na parte superior/traseira:** Elemento clicável que simula o acionamento do botão `GPIO 0`.

| Modo | Comportamento |
|---|---|
| **Robô** | Exibe o avatar integrado ao corpo do robô, com opção de alternar pernas e interagir com o botão físico |
| **Display** | Exibe apenas a tela circular preta com o avatar e a moldura externa |
| **Pixel** | Exibe a matriz de pixels ampliada em 1×, 2× ou 4×, com opção de grade de pixels sem suavização |

Recursos de inspeção visual na tela:
- **Guia de Área Segura (*Safe Area*):** Sobreposição opcional exibindo os limites do círculo visível para evitar que elementos ultrapassem a área útil e sofram corte.
- **Camada de Indicadores de Status (Overlays):** Ícones discretos opcionais no topo da tela (Wi-Fi conectado/desconectado, Nível de Bateria, Microfone mudo), espelhando o comportamento das interfaces reais em ESPHome/XiaoZhi.

### 4.2. Editor de avatar

O avatar inicial de Alfred será minimalista, expressivo e funcional, baseado em fundo preto com cor principal ciano (`#7DD3FC`).

Parâmetros editáveis em tempo real:
- **Olhos:** Formato (arredondado, elíptico, retangular suave), largura, altura, espaçamento horizontal e abertura das pálpebras (0% a 100%).
- **Sobrancelhas:** Espessura, inclinação angular, curvatura e elevação vertical.
- **Boca:** Estilo (linha curva, segmento dinâmico, oval), largura, altura, abertura vertical e raio de curvatura.
- **Cores:** Cor primária do rosto, cor de destaque/emoção e cor de fundo.
- **Brilho e Contorno:** Espessura do traço e efeito de brilho suave (*glow* sutil).

Todas as alterações refletem instantaneamente na tela sem reiniciar animações ativas.

### 4.3. Editor de animações e linha do tempo

- Criação de animações compostas por quadros-chave (*keyframes*).
- Duração configurável em milissegundos com suporte a repetição em loop ou execução única (*once*).
- Curvas de interpolação clássicas: `linear`, `easeIn`, `easeOut` e `easeInOut`.
- Controles de reprodução: Play, Pause, Stop, Voltar ao Início e avanço quadro a quadro.
- Linha do tempo visual com marcadores de keyframe arrastáveis.

### 4.4. Simulador de conversação e eventos

Cenários completos de diálogo simulado:

1. **Ciclo Completo de Diálogo:**
   - `idle` (Repouso) → Ativação (Voz, Toque ou Botão) → `wake` (Despertar) → `listening` (Ouvindo) → `thinking` (Processando) → `speaking` (Falando com emoção) → `idle` (Retorno ao repouso).
2. **Cenário de Tarefa e Sucesso:**
   - Ativação → `executing` (Executando comando) → `success` (Confirmação alegre) → `idle`.
3. **Cenário de Falha:**
   - Ativação → `error` (Confusão ou pedido de desculpas) → `idle`.
4. **Cenário de Conectividade:**
   - `connecting` (Buscando rede / servidor) → `idle` ou `error`.

Ao cancelar ou interromper um cenário, todos os timers pendentes são cancelados imediatamente, sem acúmulo de eventos atrasados.

### 4.5. Feedback sonoro sintético (Web Audio API)

Para enriquecer a simulação de assistente sem adicionar dependências externas ou arquivos pesados, a aplicação utilizará a API nativa de áudio do navegador:
- **Som de Despertar (*Wake Chime*):** Tom curto de dois acordes senoidais ao entrar em `wake`/`listening`.
- **Tom de Conclusão / Erro:** Beep agudo e suave para `success`; tom descendente para `error`.
- **Modulação de Fala Sintética:** Oscilação rítmica sutil e discreta durante o estado `speaking`, sincronizada com o movimento paramétrico da boca.
- Controle global na interface para mutar ou ajustar o volume do áudio sintético.

### 4.6. Simulador de interação física (Toque e Botão)

1. **Interação por Toque na Tela:**
   - Suporte a Toque Simples (*tap*), Toque Prolongado (*long press* - 500 ms) e Deslizamento (*swipe* em 4 direções).
   - Conversão matemática precisa das coordenadas para a área circular (`(x-120)² + (y-120)² <= 120²`).
   - Marcador visual do toque na tela com registro no painel de diagnóstico.
2. **Interação pelo Botão Físico (GPIO 0):**
   - Botão interativo localizado na carcaça superior do robô no Modo Robô e acessível via atalho de teclado (ex.: barra de espaço ou tecla `B`).
   - Pressionar simula o sinal de nível lógico baixo do `GPIO 0`, alternando o robô para o estado `listening` (*Push-to-Talk*).

---

## 5. Contrato de entrada: ponteiro, toque e botão

### 5.1. Pipeline de entrada

```text
Entrada Física/Ponteiro → Normalização de Coordenadas → Evento Lógico (LogicalTouchEvent) → Reconhecedor de Gestos → Evento de Domínio do Avatar
```

O tipo `LogicalTouchEvent` isola o domínio da entrada do navegador:
- `phase`: `'down' | 'move' | 'up' | 'cancel'`
- `x`, `y`: Coordenadas lógicas normalizadas no espaço `0` a `239`.
- `timestamp`: Milissegundos com base em relógio monotônico.
- `source`: `'mouse' | 'touch' | 'pen' | 'hardware_button'`

### 5.2. Regras de contato circular e tolerâncias

- Um contato só inicia se o clique/toque ocorrer estritamente dentro da área circular do display.
- Cliques na carcaça plástica, na moldura preta ou nas pernas são descartados pelo pipeline de toque (exceto clique no botão físico dedicado).
- Se o ponteiro sair da borda circular durante o arraste, é emitido `cancel` imediatamente.
- Limiares padrão de gestos:
  - Toque Simples: soltura em < 500 ms com deslocamento < 6 px.
  - Toque Prolongado: contato mantido por >= 500 ms com deslocamento < 6 px.
  - Deslizamento (*Swipe*): deslocamento >= 24 px com soltura sem toque prolongado prévio.

---

## 6. Estados, emoções e composição visual

### 6.1. Estados operacionais

| Identificador | Rótulo em Português | Descrição Comportamental |
|---|---|---|
| `idle` | Repouso | Olhar neutro com pequenas variações e piscadas naturais |
| `wake` | Despertando | Animação de abertura rápida dos olhos ao receber comando |
| `listening` | Ouvindo | Olhar atento e focado, indicando captação de voz |
| `thinking` | Pensando | Movimento sutil do olhar ou elemento de pulsação |
| `speaking` | Falando | Boca animada por envelope de intensidade sintética |
| `executing` | Executando | Indicador visual de comando/rotina em processamento |
| `success` | Concluído | Reação de satisfação e piscar afirmativo |
| `error` | Erro | Olhar de desapontamento ou dúvida |
| `sleep` | Dormindo | Olhos fechados, respiração visual lenta |
| `connecting` | Conectando | Olhar de busca ou ícone de sincronização de rede/Wi-Fi |
| `charging` | Carregando | Expressão calma com indicador visual sutil de bateria |
| `low_battery` | Bateria Baixa | Expressão cansada com ícone de alerta de carga |

### 6.2. Biblioteca de emoções

A biblioteca contemplará dez emoções universais mais a expressão neutra:
- `neutral` (Neutra)
- `happy` (Feliz)
- `curious` (Curioso)
- `surprised` (Surpreso)
- `confused` (Confuso)
- `suspicious` (Desconfiado)
- `angry` (Irritado)
- `sad` (Triste)
- `excited` (Animado)
- `tired` (Cansado)
- `ironic` (Irônico)

Cada emoção possui intensidade configurável entre `0.0` (neutro) e `1.0` (máxima expressão). Estado e emoção são eixos ortogonais (é possível estar em `speaking` com emoção `curious` em intensidade `0.8`).

### 6.3. Precedência de composição visual

Para evitar conflitos na renderização, a geometria do avatar obedece rigorosamente à seguinte hierarquia:

1. **Restrições de Estado:** `sleep` força pálpebras fechadas; `wake` sobrepõe qualquer pose anterior.
2. **Animação / Keyframe Ativo:** Modificadores temporais explícitos.
3. **Fala Sintética:** Modula a boca somente se o estado for `speaking`.
4. **Modificador de Emoção:** Aplica inclinações de sobrancelha e curvatura de boca da emoção selecionada.
5. **Comportamento Espontâneo:** Piscadas aleatórias e micromovimentos oculares (baseados em semente pseudoaleatória).
6. **Geometria-Base:** Parâmetros padrão definidos no editor de avatar.

---

## 7. Arquitetura técnica

### 7.1. Stack de tecnologias

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Linguagem** | TypeScript 5.x | Tipagem estrita e documentação viva dos contratos |
| **Aplicação Web** | React 19 + Vite | Alta performance de desenvolvimento e empacotamento enxuto |
| **Estilização** | Tailwind CSS v4 | Interface limpa, responsiva e de baixa sobrecarga |
| **Renderização do Avatar** | HTML5 Canvas 2D | Controle direto de pixels, máximo desempenho e portabilidade |
| **Corpo do Robô** | SVG vetorial inline | Fidelidade dimensional, redimensionamento sem perda e leveza |
| **Áudio Sintético** | Web Audio API nativa | Geração de sons e beeps sem dependência de bibliotecas de mídia |
| **Persistência Local** | IndexedDB (via `idb`) | Armazenamento estruturado e seguro de múltiplos projetos e assets |
| **Testes Unitários / Lógica** | Vitest | Execução ultrarrápida no ambiente Apple Silicon |
| **Testes de Integração E2E** | Playwright | Validação de ponta a ponta dos fluxos de tela e gestos |

### 7.2. Componentes da arquitetura

* **`AvatarEngine`:** Calcula a geometria final dos pontos do rosto com base no pipeline de precedência.
* **`CanvasRenderer`:** Renderiza o avatar no Canvas de 240 × 240, aplicando filtros opcionais (quantização RGB565).
* **`DeviceViewport`:** Controla a apresentação nos modos Robô (SVG), Display e Pixel, além das camadas de *Safe Area* e Overlays.
* **`AudioFeedback`:** Sintetiza beeps e modulações com osciladores e envelopes de ganho via Web Audio API.
* **`InputPipeline`:** Converte Pointer Events em `LogicalTouchEvent` e executa a máquina de gestos (Tap, Long Press, Swipe).
* **`HardwareButtonAdapter`:** Gerencia o acionamento físico do botão `GPIO 0`.
* **`ProjectManager`:** Gerencia salvar, recuperar, duplicar, exportar e importar projetos via IndexedDB e JSON.
* **`AssetExporter`:** Módulo extensível responsável por exportar JSON, PNG, Spritesheets, Pacotes ESPHome, MJPEG e C Arrays.

---

## 8. Projetos e formato de dados

### 8.1. Estrutura do projeto JSON (Schema v1.4)

```json
{
  "$schema": "https://alfred-studio.local/schemas/project-v1.4.json",
  "schemaVersion": 2,
  "project": {
    "id": "alfred-classic-v1",
    "name": "Alfred Classic",
    "createdAt": "2026-11-05T10:00:00Z",
    "updatedAt": "2026-11-05T10:00:00Z"
  },
  "device": {
    "profile": "XIAOZHI_ROBOT_BALL_128",
    "width": 240,
    "height": 240,
    "shape": "circle",
    "targetFps": 30,
    "colorPreview": "rgb565",
    "showLegs": true,
    "showSafeArea": false,
    "gestureThresholds": {
      "longPressMs": 500,
      "movementTolerancePx": 6,
      "swipeMinDistancePx": 24
    }
  },
  "avatar": {
    "background": "#000000",
    "primaryColor": "#7DD3FC",
    "accentColor": "#38BDF8",
    "glow": true,
    "parameters": {
      "eyes": { "shape": "rounded", "width": 48, "height": 48, "spacing": 36, "eyelidOpen": 1.0 },
      "eyebrows": { "tilt": 0, "elevation": 0, "thickness": 4 },
      "mouth": { "style": "curve", "width": 42, "openness": 0.0, "curvature": 0.3 }
    }
  },
  "runtime": {
    "defaultState": "idle",
    "defaultEmotion": "neutral",
    "randomSeed": 42,
    "soundEnabled": true
  },
  "emotions": {},
  "animations": {},
  "bindings": []
}
```

---

## 9. Exportações

O estúdio fornecerá formatos para atender tanto à prototipagem no computador quanto à integração física imediata no hardware:

### 9.1. Projeto completo (JSON)
Exportação do estado integral do projeto para backup, compartilhamento ou versionamento no Git. A importação valida o schema e aplica migrações automáticas.

### 9.2. Imagem estática (PNG 240 × 240)
Exportação do avatar na pose/estado atual em PNG transparente ou com fundo preto circular.

### 9.3. Spritesheet de animação (PNG + JSON)
Exportação de sequências de quadros organizadas em matriz com arquivo `.json` descritivo (posições, durações e loops).

### 9.4. Pacote de estados para ESPHome (PNG Set)
Exportação em lote com os nomes padronizados exigidos pelas integrações de assistente de voz do ESPHome / Home Assistant (`RealDeco/xiaozhi-esphome`):
- `idle.png` (Repouso)
- `listening.png` (Ouvindo)
- `thinking.png` (Processando)
- `replying.png` (Falando)
- `error.png` (Erro)
- `loading.png` (Inicialização)
- `mute.png` (Microfone mudo)

### 9.5. Vídeo de animação para cartão SD (MJPEG / Sequência JPEG)
Como o hardware Spotpear Ball V2 conta com decodificador nativo de **MJPEG via MicroSD sem reprogramação**, o estúdio permitirá exportar a animação selecionada como:
- Arquivo de vídeo MJPEG circular (240 × 240 @ 30 FPS).
- Sequência de quadros JPEG nomeados para gravação direta no cartão TF.
- **Benefício:** Permite validar visualmente a animação no robô real no mesmo dia em que o pacote for entregue, sem necessidade de ferramentas de gravação de firmware.

### 9.6. C Array / Header LVGL (`lv_img_dsc_t` / RGB565)
Exportação de quadros ou ícones diretamente como arquivo `.c` e `.h` em formato RGB565 ou binário LVGL, pronto para inclusão no código fonte C++ do ESP-IDF ou Arduino.

---

## 10. Requisitos funcionais e prioridades

| ID | Requisito | Prioridade | Fase |
|---|---|:---:|:---:|
| **RF-01** | Simulador com display circular de 240 × 240 pixels | **P0** | Fase 1 |
| **RF-02** | Representação vetorial 2D do corpo do robô esférico | **P0** | Fase 1 |
| **RF-03** | Alternância entre modos Robô, Display e Pixel | **P0** | Fase 1 |
| **RF-04** | Editor paramétrico do rosto (olhos, boca, sobrancelhas e cores) | **P0** | Fase 1 |
| **RF-05** | Máquina de estados operacionais e transições automáticas | **P0** | Fase 1 |
| **RF-06** | Simulador de diálogo e cenários pré-configurados | **P0** | Fase 1 |
| **RF-07** | Pipeline de toque simples com conversão para display circular | **P0** | Fase 1 |
| **RF-08** | Simulação do botão físico Boot (GPIO 0) na carcaça e por atalho | **P0** | Fase 1 |
| **RF-09** | Persistência local de projetos via IndexedDB | **P0** | Fase 1 |
| **RF-10** | Alternância visual de pernas removíveis (Com Pernas / Esfera Pura) | **P1** | Fase 1 |
| **RF-11** | Guia de Área Segura circular (*Safe Area*) na tela | **P1** | Fase 1 |
| **RF-12** | Biblioteca de 10 emoções com controle de intensidade ortogonal | **P1** | Fase 2 |
| **RF-13** | Comportamentos espontâneos (piscadas e olhar sutil reproduzíveis) | **P1** | Fase 2 |
| **RF-14** | Editor de linha do tempo e quadros-chave (Keyframes) | **P1** | Fase 3 |
| **RF-15** | Toque prolongado (*long press*) e deslizamentos (*swipe* 4 direções) | **P1** | Fase 3 |
| **RF-16** | Feedback sonoro sintético local via Web Audio API (beeps/modulação) | **P1** | Fase 3 |
| **RF-17** | Prévia quantizada em RGB565 | **P1** | Fase 2 |
| **RF-18** | Exportação e importação de projetos em JSON | **P1** | Fase 2 |
| **RF-19** | Exportação de imagens PNG (estática e pacote de estados ESPHome) | **P1** | Fase 2 |
| **RF-20** | Exportação de Spritesheets com metadados | **P1** | Fase 3 |
| **RF-21** | Exportação de animação em formato MJPEG para Cartão SD | **P1** | Fase 3 |
| **RF-22** | Exportação de C Array / Header compatível com LVGL (RGB565) | **P1** | Fase 3 |
| **RF-23** | Painel de diagnósticos (FPS em tempo real, coordenadas e histórico de toque) | **P1** | Fase 3 |
| **RF-24** | Gravação e reprodução de sequências de toque pelo usuário | **P2** | Pós-Fase 3 |
| **RF-25** | Integração WebSerial direta para gravação e flash do dispositivo | **P2** | Fase 5 |

---

## 11. Requisitos não funcionais

### 11.1. Desempenho e consumo
- O estúdio deve rodar com suavidade e conforto no MacBook Air M3 com 8 GB de RAM.
- Manter taxa de quadros estável em **30 FPS** no modo de reprodução de animação.
- Não disparar re-renderizações desnecessárias da árvore React durante o loop do Canvas.
- Suspender a execução de timers e renderização quando a aba do navegador estiver em segundo plano.

### 11.2. Estimativa de memória gráfica
Exibir estimativas matemáticas separadas das medições reais de runtime:

| Representação de Display | Cálculo | Memória Bruta |
|---|---|---:|
| Um framebuffer RGB565 | `240 × 240 × 2 bytes` | 115.200 bytes (112,5 KiB) |
| Dois framebuffers RGB565 (Double Buffer) | `240 × 240 × 2 × 2 bytes` | 230.400 bytes (225,0 KiB) |
| Um raster RGBA (32 bits) no Canvas | `240 × 240 × 4 bytes` | 230.400 bytes (225,0 KiB) |

Esses valores são estritamente orçamentos de tela e não representam a memória total disponível no ESP32-S3 (que conta com 8 MB de PSRAM dedicados).

### 11.3. Segurança e operação local
- Operação 100% offline após instalação das dependências.
- Nenhuma dependência de nuvem, telemetria ou envio de dados para servidores externos.
- O servidor local do Vite escutará estritamente na interface de loopback (`127.0.0.1`).
- Arquivos JSON importados são rigorosamente validados contra schema e não executam código ou HTML arbitrário.

---

## 12. Fases de execução e critérios de aceite

### Fase 1 — Simulador Básico e Estrutura do Dispositivo
* **Entregáveis:**
  - Aplicação executável localmente via `npm run dev`.
  - Interface em português com Tailwind CSS.
  - Modos de visualização Robô (com toggle de pernas removíveis e botão GPIO 0), Display e Pixel.
  - Renderizador Canvas 2D com avatar inicial de Alfred e guia de Área Segura.
  - Estados operacionais fundamentais (`idle`, `wake`, `listening`, `thinking`, `speaking`, `executing`, `success`, `error`, `sleep`).
  - Cenário de conversação com toque simples na tela e clique no botão físico.
  - Persistência básica no IndexedDB.
* **Critério de Aceite:**
  O usuário abre o estúdio, altera a geometria básica do rosto, toca no botão ou na tela circular e observa a transição de estado no robô virtual. Ao recarregar a página, as alterações permanecem salvas.

### Fase 2 — Personalização, Emoções e Exportações de Imagem
* **Entregáveis:**
  - Controles completos de geometria facial e paleta de cores.
  - Biblioteca das 10 emoções com controle contínuo de intensidade.
  - Comportamentos espontâneos (piscadas pseudoaleatórias com semente reproduzível).
  - Prévia com filtro quantizado RGB565.
  - Exportação e importação completa de projetos em JSON.
  - Exportação de PNG estático e do pacote de estados padronizado para ESPHome.
* **Critério de Aceite:**
  O usuário cria e salva dois avatares distintos, exporta o pacote de imagens do ESPHome e reimporta um arquivo JSON com 100% de integridade das configurações.

### Fase 3 — Animação, Gestos Avançados, Som e Mídia
* **Entregáveis:**
  - Linha do tempo visual com editor de quadros-chave e curvas de interpolação.
  - Reconhecimento completo de toque prolongado e deslizamentos em 4 direções.
  - Feedback sonoro sintético local via Web Audio API.
  - Exportação de Spritesheets com JSON de metadados.
  - Exportação de animações em MJPEG (para teste via cartão MicroSD no dispositivo real).
  - Exportação de quadros em C Array / Header LVGL.
  - Painel de métricas e diagnóstico de toque.
* **Critério de Aceite:**
  O usuário cria uma sequência animada completa com feedback sonoro, testa os gestos de swipe e exporta o arquivo MJPEG e a spritesheet correspondentes à cena sem travamento da aplicação.

### Fase 4 — Recebimento, Inspeção Física e Validação Inicial
*(Condicionada à chegada do equipamento físico)*
* **Atividades:**
  1. Inspeção externa do Spotpear Ball V2 (presença de bateria, touch e slot SD).
  2. Teste inicial do modo SD: inserção de cartão MicroSD contendo o arquivo MJPEG gerado na Fase 3 para validar a reprodução direta na tela física sem alteração de firmware.
  3. Conexão via USB-C e verificação das portas seriais (`esptool.py flash_id` ou via navegador via ESPHome Web / Espressif Launchpad).
  4. Extração e backup da imagem de fábrica original da Flash de 16 MB.

### Fase 5 — Integração Física e Modos de Operação
*(Condicionada aos resultados da Fase 4)*
* **Caminhos de Integração Mapeados:**
  - **Caminho A (Nativo XiaoZhi AI):** Substituição do pacote de assets no firmware original para exibir o rosto de Alfred durante os diálogos com DeepSeek.
  - **Caminho B (ESPHome / Home Assistant):** Utilização da configuração do projeto comunitário `RealDeco/xiaozhi-esphome` (`Ball_v2.yaml`), carregando o pacote de imagens gerado pelo Alfred Avatar Studio para atuar como satélite de voz local.

---

## 13. Referências e recursos técnicos

1. **Repositório Oficial do Firmware XiaoZhi:**
   - [`78/xiaozhi-esp32`](https://github.com/78/xiaozhi-esp32)
   - [Configuração de Hardware da Placa Spotpear Ball V2 (`sp-esp32-s3-1.28-box`)](https://github.com/78/xiaozhi-esp32/tree/main/main/boards/spotpear/sp-esp32-s3-1.28-box)
2. **Repositório Comunitário para ESPHome / Home Assistant:**
   - [`RealDeco/xiaozhi-esphome`](https://github.com/RealDeco/xiaozhi-esphome)
   - [Configuração YAML Spotpear Ball V2 (`devices/Spotpear Balls/Ball_v2.yaml`)](https://github.com/RealDeco/xiaozhi-esphome/blob/main/devices/Spotpear%20Balls/Ball_v2.yaml)
3. **Anúncio Comercial de Referência:**
   - AliExpress Item [1005008627679270](https://www.aliexpress.com/item/1005008627679270.html) / Shortlink `https://a.aliexpress.com/_mtudvQn`
4. **Geradores e Utilitários de Assets:**
   - [`78/xiaozhi-assets-generator`](https://github.com/78/xiaozhi-assets-generator)
   - [`socdevvv/xiaozhi-face`](https://github.com/socdevvv/xiaozhi-face)

---

## 14. Validação e evidências

### 14.1. Testes essenciais (Vitest)
Cobrir com testes automatizados:
- Estados, transições válidas e tratamento controlado de eventos inválidos.
- Independência estrita entre estado operacional e emoção ativa.
- Hierarquia de precedência de composição visual do avatar.
- Cancelamento imediato de cenários de conversação e descarte de timers pendentes.
- Reprodutibilidade exata de comportamentos espontâneos com semente configurada.
- Persistência e recuperação de projetos após recarga de página.
- Validação de schemas JSON na importação, rejeição de cargas inválidas e migração de versões.
- Metadados, dimensões e limites nas exportações (PNG, Spritesheet, MJPEG, C Array).

### 14.2. Testes de entrada e gestos (Playwright)
- Conversão de coordenadas em escala 1×, 2× e 4× nos três modos de visualização.
- Independência em relação ao `devicePixelRatio` do monitor.
- Rejeição de cliques fora do círculo e cancelamento imediato ao sair da área útil.
- Acionamento do botão físico no corpo do robô e por atalho de teclado.
- Limiares de toque simples, toque prolongado (500 ms) e swipe nas 4 direções.

---

## 15. Riscos técnicos e mitigações

| Risco Identificado | Severidade | Estratégia de Mitigação |
|---|:---:|---|
| Variante entregue sem painel touch montado | Média | O simulador e o assistente tratam toque como entrada opcional; o botão físico `GPIO 0` e o comando de voz garantem 100% de operabilidade |
| Firmware original bloqueado ou sem suporte a assets customizados | Baixa | A presença do slot SD com suporte nativo a MJPEG permite validação visual direta; a opção do ESPHome oferece alternativa de firmware livre |
| Divergência de cores entre Canvas sRGB e LCD GC9A01 | Baixa | O filtro de quantização RGB565 no estúdio permite antecipar faixas de posterização e calibrar contraste antes do envio ao hardware |
| Perda de projetos locais no navegador | Média | Salvamento automático no IndexedDB somado a aviso visual e atalho rápido para exportação de backup em JSON |
| Quedas de FPS durante animações complexas | Baixa | Arquitetura desacoplada onde o loop de renderização do Canvas roda independente do estado do React; opção de limitar a 15/30 FPS |

---

## 16. Conclusão da especificação

O **Alfred Avatar Studio** está agora completamente alinhado com o hardware real identificado (**Spotpear Ball V2**). 

Com as Fases 1 a 3 definidas de forma independente e orientada a dados, o usuário tem em mãos uma ferramenta completa de autoria e simulação para desenhar a identidade do assistente Alfred, com a garantia de que os formatos exportados (PNG, ESPHome Set, Spritesheet, MJPEG e C Array) estarão prontos para rodar no robô físico no primeiro dia de sua entrega.
