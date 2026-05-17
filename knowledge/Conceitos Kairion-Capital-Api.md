# Conceitos por trás do Kairion Capital API

Esse documento é a contraparte conceitual da [Documentacao Kairion-Capital-Api](./Documentacao%20Kairion-Capital-Api.md). Enquanto a documentação descreve **como o código está organizado**, aqui o foco é **o que cada conceito significa** — começando pelo domínio de finanças quantitativas (Assets, Market Data, Portfolio, Analytics, Backtests) e terminando nas duas libs centrais da stack (Fastify e `pg`/Prisma).

---

## Parte 1 — Conceitos de finanças quantitativas

### 1. Assets (Ativos)

#### O que é

**Ativo** é qualquer coisa negociável num mercado organizado e que tem preço observável ao longo do tempo. Em código, é só uma "ficha de identidade": o que é, onde negocia, em qual moeda. Não tem preço embutido — preço mora em outro lugar (Market Data).

#### Por que existe esse modelo separado

Sem um catálogo de ativos:
- você não tem como referenciar "PETR4" sem repetir a string em várias tabelas;
- não consegue ter integridade referencial (FK) ligando histórico de preços, posições de carteira e backtests ao mesmo ativo;
- não tem onde guardar metadados estáveis (nome, exchange, currency).

#### Campos do modelo

```
symbol      → ticker (PETR4, AAPL, BTC...)
exchange    → bolsa/venue (B3, NASDAQ, BINANCE...)
type        → STOCK, ETF, CRYPTO, FX, INDEX, FUND, BOND, OTHER
currency    → moeda em que o ativo é cotado (BRL, USD...)
```

A unicidade é por `(symbol, exchange)` porque o **mesmo símbolo pode existir em bolsas diferentes** com preços e regras distintas (ex.: ações duplas listadas em NYSE e LSE; "AAPL" na NASDAQ ≠ "AAPL" em outras venues).

#### Tipos de ativos (rápido)

| Tipo   | Exemplo       | Característica                                                                  |
| ------ | ------------- | ------------------------------------------------------------------------------- |
| STOCK  | PETR4, AAPL   | Ação ordinária / preferencial. Liquidez alta, fundamentos disponíveis.          |
| ETF    | BOVA11, SPY   | Cesta de ativos negociada como ação. Boa para diversificação.                   |
| CRYPTO | BTC, ETH      | Negocia 24/7, sem "candle diário canônico" (depende da exchange e do timezone). |
| FX     | USD/BRL       | Pares de moeda. Preço é uma razão, não unidade.                                 |
| INDEX  | IBOV, S&P 500 | Não é negociável diretamente, mas tem série de preços e é benchmark.            |
| FUND   | Fundos        | Tipicamente preço diário (cota), não intraday.                                  |
| BOND   | Tesouro       | Preço derivado da curva de juros, pode ter cupom periódico.                     |

> No projeto, todos viram a mesma tabela `Asset` — a diferença operacional fica na hora de buscar dados (provider) e calcular métricas.

---

### 2. Market Data (Dados de Mercado)

#### O que é

**Market data** é a série temporal de preços e volumes de um ativo. É a "memória" do mercado: quanto custou, quanto se negociou, quando.

#### Candle / OHLCV

Para cada janela de tempo (`interval`), o mercado é resumido por **5 números**:

| Campo  | Significado                                                    |
| ------ | -------------------------------------------------------------- |
| Open   | Primeiro preço negociado dentro da janela                      |
| High   | Maior preço dentro da janela                                   |
| Low    | Menor preço dentro da janela                                   |
| Close  | Último preço negociado dentro da janela                        |
| Volume | Quantidade total negociada dentro da janela                    |

Visualmente vira o famoso **candle** (vela japonesa) usado em gráficos. O nome "bucket" no código (`bucketStart`) vem dessa ideia: a janela é um "balde" no tempo, e `bucketStart` é o instante de início do balde.

#### Intervalos

Os mais comuns: 1m, 5m, 15m, 1h, 1d, 1w. O projeto **só suporta `DAY`** (`CandleInterval.DAY`), o que é uma decisão importante porque:

- Simplifica armazenamento (uma linha por dia).
- Bate com a granularidade típica de research/backtest de longo prazo.
- Fica trivial de anualizar (assumindo `TRADING_DAYS_PER_YEAR = 252`).
- Evita complicação de timezone em intraday.

#### Por que precisamos sincronizar

A API do projeto não busca preços ao vivo a cada request — ela **persiste candles localmente**. Isso é padrão por três razões:

1. **Custo:** APIs de market data têm rate limit (Alpha Vantage free é ~5 chamadas/min e 500/dia).
2. **Latência:** consultar localmente é ~milhares de vezes mais rápido que sair pela rede.
3. **Reprodutibilidade:** se o provedor muda dado histórico, seu backtest do mês passado para de bater. Persistindo, você "congela" o histórico.

O fluxo é: `POST /assets/:id/sync-prices` → provider devolve candles → `upsertCandles` grava (chave `assetId + interval + bucketStart`). `GET /assets/:id/prices` consulta a tabela local.

#### Provider abstraction

A interface `MarketDataProvider` (`searchAssets`, `getQuote`, `getHistoricalPrices`) existe para que **trocar de fornecedor não exija reescrever lógica**. Hoje só tem Alpha Vantage; amanhã pode ter Yahoo Finance, B3 oficial, Polygon, etc. Cada um implementa a mesma interface e o resto do sistema não muda.

---

### 3. Portfolio (Carteira)

#### O que é

**Portfolio** é um conjunto de posições (asset + alocação) que você quer tratar como uma unidade. É o que separa "estudar um ativo" de "estudar uma estratégia de investimento".

#### Por que ter `targetWeight` xor `quantity`

São **duas formas legítimas de descrever uma carteira**, e cada uma serve para um cenário diferente:

##### Modo `targetWeight` (peso-alvo)

Você diz "quero 60% em ações e 40% em bonds". O peso é uma **fração** (0,6 e 0,4). Não importa quanto dinheiro você tem; importa a **proporção**.

Vantagens:
- Independente de capital → fácil para análise teórica.
- Bate com como gestores e research papers descrevem estratégias ("60/40").
- Permite comparar carteiras de tamanhos diferentes.

Como vira retorno: a cada dia, retorno do portfolio = soma ponderada dos retornos dos ativos.
> `r_p(t) = Σ w_i × r_i(t)`

##### Modo `quantity` (quantidade real)

Você diz "tenho 100 ações da PETR4 e 50 da VALE3". O peso emerge dos preços — quem subiu mais ganha peso.

Vantagens:
- Reflete **exatamente** o que você comprou (útil para PnL real).
- Permite "rebalanceamento natural": se um ativo dispara, ele vai dominando.
- Não precisa rebalancear sempre (custos operacionais menores em tese).

Como vira retorno: marca a mercado (`mark-to-market`) o valor total a cada dia e calcula o retorno desse valor.
> `V(t) = Σ q_i × P_i(t)` ; `r_p(t) = V(t)/V(t-1) - 1`

##### Por que misturar é proibido

Se metade das posições tem peso e a outra metade tem quantidade, o retorno do portfolio fica matematicamente ambíguo (qual a "porção" da carteira ocupada por cada modo?). Tecnicamente daria pra resolver, mas é uma confusão sem ganho. O projeto rejeita explicitamente com `MixedPortfolioAllocationError`.

#### Currency uniforme

`getPortfolioMetricsService` exige uma única `currency`. Sem isso, somar PETR4 (BRL) + AAPL (USD) seria como somar maçãs com laranjas — você precisaria de uma série de FX para converter dia a dia. É uma simplificação consciente: enquanto não tem motor de FX, o sistema **falha cedo** com `CurrencyMismatchError`.

---

### 4. Analytics (Métricas Quantitativas)

Esse é o coração quant do projeto. Todas as métricas partem de uma série de **retornos diários simples**.

#### Retorno simples vs log

- **Simples:** `r_t = P_t / P_{t-1} - 1` → +5% significa "o preço subiu 5% em relação a ontem".
- **Log:** `r_t = ln(P_t / P_{t-1})` → matematicamente mais "limpo" porque é aditivo no tempo, mas perde a interpretação intuitiva de "quanto rendeu".

O projeto usa **simples** (mais comum em research aplicado e em produtos de cliente). A escolha está documentada em `assumptions.returnType: "simple"` na resposta dos endpoints.

#### Cumulative Return (Retorno Acumulado)

> `cum = ∏(1 + r_i) - 1`

O "quanto rendeu no fim das contas". Usa o produto (não a soma) porque o capital cresce de forma multiplicativa: ganhar 10% e depois mais 10% é 21%, não 20%.

#### Volatility (Volatilidade)

> `σ = sample_std_dev(returns)` (com correção de Bessel, divide por `n-1`)

É o **desvio-padrão dos retornos diários**. Mede o quanto o ativo "balança". Por convenção, a volatilidade reportada normalmente é a **anualizada**:

> `σ_anual = σ_diário × √252`

A multiplicação por `√252` vem da hipótese de que retornos diários são independentes e identicamente distribuídos: a variância acumula linearmente no tempo (`var × dias`), então o desvio acumula com `√dias`. É uma aproximação útil, não uma verdade.

#### Sharpe Ratio

> `Sharpe = (média do excess return) / σ × √252`

Mede **retorno por unidade de risco**. "Excess return" é o retorno acima da taxa livre de risco (no projeto, `riskFreeAnnual = 0` por default, então excess = retorno bruto).

Interpretação:
- Sharpe > 1 → bom
- Sharpe > 2 → muito bom
- Sharpe > 3 → excepcional (e provavelmente cherry-picking ou bug)
- Sharpe < 0 → você perdeu para o caixa

Limitação: assume que volatilidade é uma boa medida de risco. Mas vol penaliza tanto **upside** quanto **downside** — você é "punido" por ter dias muito bons. Daí o…

#### Sortino Ratio

> `Sortino = (média do excess return) / downside_deviation × √252`

Igual ao Sharpe, mas o denominador só conta os retornos **abaixo** da taxa de mínima aceitação (MAR). É mais "justo" porque foca apenas no risco que importa: perder.

> Nota técnica do projeto: o Sharpe usa `n-1` no denominador (sample std dev) e o Sortino usa `n` (population). É a convenção mais comum, mas vale saber para reconciliar com outras ferramentas.

#### Maximum Drawdown (MDD)

> `MDD = min_t (W_t / max_{s≤t} W_s) - 1`

Onde `W_t` é o **wealth path normalizado** (capital crescendo de 1 reaplicando os retornos).

Em palavras: percorre a curva de capital, registra o pico mais alto até cada momento, e mede a **maior queda do pico até o vale subsequente**. Sempre ≤ 0.

Por que importa: dois ativos podem ter o mesmo Sharpe e drawdowns muito diferentes. MDD é a métrica de "psicologia" — é o tamanho do prejuízo que você precisaria aguentar sem capitular.

#### Drawdown Duration

Quantos **períodos** (dias úteis, no caso) o ativo levou do **pico** até o **vale** da pior queda. É a duração do "vale da morte". Não conta a recuperação, só a descida.

> Existem variantes na literatura (peak-to-recovery, peak-to-new-peak); o projeto usa **peak-to-trough** (mais conservador para caracterizar o pior trecho).

---

### 5. Backtests

#### O que é

**Backtest** é simular como uma estratégia teria performado **se você tivesse aplicado ela no passado**, usando dados históricos. É a forma mais barata de testar uma ideia de investimento antes de arriscar dinheiro.

Resposta tipo: "se eu tivesse seguido a regra X de janeiro/2020 a hoje, teria saído com Y, contra Z se tivesse só comprado e segurado o ativo".

#### A estratégia implementada: Moving Average Crossover

É uma estratégia clássica de **trend following** (seguir tendência):

1. Calcula duas médias móveis dos preços: uma **rápida** (ex.: 20 dias) e uma **lenta** (ex.: 50 dias).
2. **Sinal de compra:** quando a fast cruza para cima da slow (`SMA_fast > SMA_slow`).
3. **Sinal de venda:** quando a fast cruza para baixo (`SMA_fast ≤ SMA_slow`).
4. Posição binária: você está **long** (100% comprado) ou em **caixa** (0%).

Intuição: se o preço de curto prazo está acima da tendência longa, há momentum positivo → compra. Senão, fica fora.

#### Conceitos sutis (e por que importam)

##### Lookahead bias

Erro grave em backtests: usar informação que você **não teria** no momento da decisão. Exemplo: olhar o close de hoje pra decidir comprar hoje no close de hoje. Soa bobo, mas acontece.

A engine do projeto evita assim:

> "Sinal no bar `t` define posição `pos[t]`, que é aplicada no retorno do **próximo** bar (`P[t+1]/P[t] - 1`)."

Isso garante que a decisão é tomada com info do dia D e o trade é executado no dia D+1 (ou na abertura do D+1, simulado pelo close do D).

##### Warmup

Você precisa de pelo menos `slowPeriod` candles antes de poder calcular a SMA lenta. Antes disso, **não há sinal possível**. O projeto:

- Mantém `pos[t] = 0` (caixa) durante o warmup → estratégia não opera.
- Começa a `series` em `firstSignalBarIndex = slowPeriod - 1`.
- Faz o **buy-and-hold** (BH) começar **na mesma data** do warmup, para a comparação ser justa (não vale dar vantagem ao BH começando em t=0 e à estratégia em t=warmup).

##### Comparação com Buy-and-Hold

A pergunta básica de qualquer backtest é: **"isso é melhor do que simplesmente comprar e segurar?"**

Se sua estratégia rendeu 30% mas o BH no mesmo período rendeu 40%, você teve trabalho à toa (e provavelmente pagou mais imposto/corretagem). É por isso que `series` traz `strategyEquity` e `buyHoldEquity` lado a lado e o `summary` traz os totais dos dois.

##### O que o projeto **ainda não modela**

Um backtest "completo" de produção considera:
- **Custos operacionais:** corretagem, taxas.
- **Slippage:** o preço de execução real raramente é o close.
- **Impostos:** IR sobre ganho de capital.
- **Liquidez:** dá para realmente entrar/sair daquele tamanho?
- **Múltiplas estratégias e sizing dinâmico** (não só long/cash).

Tudo isso é roadmap explícito (Fase 10).

---

## Parte 2 — Conceitos de stack

### 6. Fastify

#### O que é

**Fastify** é um framework HTTP para Node.js (alternativa ao Express). Mesmo modelo geral — você define rotas, recebe `request`/`reply`, registra "plugins" — mas com três diferenças importantes:

1. **Performance:** o roteador interno é dos mais rápidos do ecossistema Node.js (usa `find-my-way` baseado em radix tree).
2. **Validação e serialização baseadas em schema:** você pode declarar schemas (JSON Schema, Zod, TypeBox) e o Fastify usa eles tanto para validar entrada quanto para gerar **serializadores otimizados** de resposta. Isso é literalmente código JIT-compilado para o seu schema.
3. **Sistema de plugins encapsulado:** plugins têm escopo (você pode registrar algo só num subconjunto de rotas), e o Fastify **força ordem de inicialização** correta (await em todos os `register`).

#### Por que faz sentido para essa API

- Boa parte das rotas envolve cálculos relativamente pesados (analytics, backtests). Quanto menos overhead no framework, melhor.
- O ecossistema oficial cobre tudo o que precisamos: `@fastify/cors`, `@fastify/jwt`, `@fastify/sensible`, `@fastify/swagger` (futuro).
- O sistema de **decoradores** (`app.decorate("authenticate", ...)`) é a forma idiomática de injetar dependências/middlewares — usado no projeto para o middleware de autenticação JWT.

#### Conceitos do Fastify usados no código

| Conceito          | Onde aparece                                            | Para quê                                                                  |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `register(plugin)`| `app.register(jwt, { secret })`                         | Carrega funcionalidade encapsulada com config própria.                    |
| `decorate`        | `authenticatePlugin` adiciona `app.authenticate`        | "Atributo" da instância Fastify acessível em qualquer rota.               |
| `preHandler`      | `{ preHandler: [app.authenticate] }` em rotas privadas  | Middleware que roda antes do handler — aqui valida o JWT.                 |
| `setErrorHandler` | `error-handler.ts`                                      | Captura erros não tratados e formata a resposta.                          |
| `request.user`    | Em rotas autenticadas, vem de `jwtVerify`               | Tipado via `src/@types/fastify-jwt.d.ts`.                                 |
| `reply.jwtSign`   | `auth/routes.ts`                                        | Gera token JWT no login/registro.                                         |
| `fastify-plugin`  | Wrap em `authenticate.ts` e `error-handler.ts`          | Sem esse wrap, o decorador "morreria" no escopo do plugin (encapsulamento default). Com `fp(...)`, ele "vaza" pro escopo pai. |

> **Pegadinha do encapsulamento:** se você esquecer o `fastify-plugin` no `authenticatePlugin`, o `app.authenticate` simplesmente **não vai existir** nas rotas registradas fora desse plugin. É um erro silencioso e confuso de debugar.

#### Comparação rápida com Express

| Aspecto           | Express                              | Fastify                                                       |
| ----------------- | ------------------------------------ | ------------------------------------------------------------- |
| Validação         | Manual (Joi/Zod montado por você)    | Nativo via schema, com serializer otimizado                   |
| Performance       | Boa                                  | ~2-3x mais throughput em benchmarks típicos                   |
| Tipagem TS        | Funcional, mas verbosa               | Excelente: gera tipos a partir dos schemas                    |
| Plugins           | "Use middleware"                     | Sistema próprio com escopo e ordem de boot                    |
| Logger            | Você escolhe (morgan, winston)       | `pino` integrado e rápido                                     |

---

### 7. `pg` (e como ele se encaixa no Prisma)

#### O que é

`pg` é o **driver oficial de baixo nível** do PostgreSQL para Node.js. Ele faz uma única coisa: abrir conexão TCP com o servidor Postgres, mandar queries SQL, ler o protocolo binário e devolver resultados em JS.

```js
const { Client } = require('pg');
const client = new Client({ connectionString: '...' });
await client.connect();
const res = await client.query('SELECT * FROM "User" WHERE email = $1', [email]);
```

É a base — todo ORM/query builder em Node que fala Postgres usa `pg` (ou `postgres` da Porsager, um competidor mais novo) por baixo.

#### Por que ele aparece nas dependências do projeto, junto com Prisma?

Porque o projeto usa o **adapter driver** do Prisma 7, especificamente o `@prisma/adapter-pg`:

```ts
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

Esse modelo é uma mudança importante introduzida em versões recentes do Prisma. Vamos ver o que muda.

##### Modo "engine binário" (clássico, Prisma ≤ 5)

- Prisma vinha com um **binário Rust** (`query-engine`) que falava o protocolo Postgres por conta própria.
- Sua app Node.js conversava com o engine via JSON-RPC local.
- Vantagem: portabilidade (mesmo client, vários DBs).
- Desvantagens: peso (~20-30 MB extras), deploy complicado em ambientes serverless (Lambda, Edge), dificuldade de auditar conexões.

##### Modo "driver adapter" (atual, Prisma 6+ e default no 7)

- O Prisma usa um driver Node.js puro (no caso, `pg`) para falar com o banco.
- O adapter (`@prisma/adapter-pg`) é uma **ponte fininha** que traduz chamadas do PrismaClient para chamadas no `pg`.
- Vantagens: 
  - Sem binário Rust → bundles menores, deploy serverless trivial.
  - Você pode passar configurações de conexão complexas (pool, SSL, statement timeout) do `pg` direto.
  - Em **edge runtimes** (Cloudflare Workers, Vercel Edge), você pode trocar `pg` por drivers compatíveis com fetch (ex.: `@neondatabase/serverless`).
- Desvantagem: você é responsável por ter o driver compatível instalado.

#### Resumindo a arquitetura de dados do projeto

```
Sua rota Fastify
       │
       ▼
prisma.asset.findMany({ where: ... })   ← API tipada do Prisma
       │
       ▼
PrismaClient (TS) gera o plano de query
       │
       ▼
@prisma/adapter-pg traduz pra SQL real
       │
       ▼
pg abre conexão TCP/SSL → Postgres
       │
       ▼
Postgres responde → pg parse → adapter → Prisma → JS object tipado
```

#### Por que não usar `pg` direto?

Você até poderia, mas perderia:
- **Migrations versionadas** (`prisma migrate`).
- **Tipos gerados a partir do schema** (zero risco de typo num campo).
- **Relations já resolvidas** (`include: { assets: true }`).
- **Validação no boot** (Prisma reclama se schema e DB divergem).

E ganharia em troca: SQL cru livre, controle total de conexão. Para esse projeto (CRUD + algumas queries seletivas), **Prisma + pg via adapter** é o sweet spot.

---

## TL;DR

- **Asset:** ficha de identidade do que se negocia. Sem preço.
- **Market Data:** série temporal de candles (OHLCV). Persistida localmente para custo, latência e reprodutibilidade.
- **Portfolio:** conjunto de posições com alocação por **peso** (proporção) ou **quantidade** (unidades), nunca os dois ao mesmo tempo.
- **Analytics:** transforma série de preços → série de retornos → métricas de retorno (cumulativo), risco (vol, MDD, duração), e relação risco/retorno (Sharpe, Sortino).
- **Backtests:** simula uma estratégia (no caso, MA crossover) no histórico, sem lookahead, comparada com buy-and-hold.
- **Fastify:** framework HTTP focado em performance, schema-first e plugins encapsulados.
- **pg + adapter:** driver Postgres usado pelo Prisma 7 como ponte real ao banco. Tira o binário Rust da equação e simplifica o deploy.
