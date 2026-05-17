# Documentação — Kairion Capital API

> Backend de análise quantitativa de investimentos: catálogo de ativos, sincronização de market data, carteiras, métricas (retorno, vol, Sharpe, Sortino, drawdown) e backtest de Moving Average Crossover com integração opcional ao microservice Rust `quantix`.

Esse documento mapeia o estado atual do projeto após as Fases 1–8 do roadmap, descreve cada módulo, suas regras de negócio, contratos HTTP, e finaliza com uma lista priorizada de bugs/débitos técnicos que precisam ser ajustados antes da Fase 9 (Infra/Qualidade).

---

## 1. Visão geral da arquitetura

### 1.1. Stack

- **Runtime:** Node.js (TypeScript, ESM, `target: ES2022`, `module: NodeNext`)
- **HTTP:** Fastify 5 + `@fastify/jwt`, `@fastify/cors`, `@fastify/sensible`
- **Validação:** Zod 4
- **ORM:** Prisma 7 com adapter `@prisma/adapter-pg` (driver `pg`)
- **DB:** PostgreSQL 16 (Docker Compose)
- **Auth:** JWT + bcryptjs
- **Market data:** Alpha Vantage (provider plugável)
- **Quant engine:** TypeScript puro + bridge HTTP para `quantix` (Rust)
- **Dev:** `tsx watch`

### 1.2. Estrutura de pastas (resumo)

```
src/
  app/                # bootstrap Fastify, plugins, rotas globais
    plugins/          # authenticate, error-handler
    routes/           # health
  modules/
    auth/             # register, login (rotas + services + schemas)
    users/            # /users/me e repositório de User
    assets/           # catálogo de ativos
    market-data/      # provider, candles, sync e listagem de preços
    portfolios/       # carteiras + alocações (peso ou quantidade)
    analytics/        # métricas por ativo e por carteira + lib `metrics.ts`
    backtests/        # engine MA crossover + persistência + rotas
  lib/
    env.ts            # validação de env com Zod
    prisma.ts         # PrismaClient + PrismaPg adapter
    quantix/          # client HTTP + fallbacks TS
  generated/prisma/   # client gerado pelo Prisma (versionado)
prisma/
  schema.prisma       # User, Asset, Portfolio, PortfolioAsset, Candle, BacktestRun
  migrations/         # 5 migrations já aplicadas
  seed.ts             # PETR4, VALE3, AAPL, BTC
scripts/
  quantix-stub-server.ts  # mock HTTP do quantix usando a própria lógica TS
```

### 1.3. Bootstrap (`src/index.ts` + `src/app/app.ts`)

`buildApp()` registra, nesta ordem:

1. `@fastify/cors` (`origin: true`)
2. `@fastify/sensible`
3. `@fastify/jwt` (segredo = `env.JWT_SECRET`)
4. `authenticatePlugin` (decora `app.authenticate`)
5. `errorHandlerPlugin` (apenas `ZodError → 400`; resto faz `reply.send(error)`)
6. Rotas com prefixos: `/health`, `/auth`, `/users`, `/assets`, `/portfolios`, `/backtests`

`bootstrap()` chama `app.listen({ port: env.PORT, host: "0.0.0.0" })`.

### 1.4. Modelo de dados (Prisma)

```
User (1) ─< Portfolio (1) ─< PortfolioAsset >─ (1) Asset (1) ─< Candle
User (1) ─< BacktestRun >─ (1) Asset
```

| Modelo           | Pontos relevantes                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `User`           | `email` único, `passwordHash`, cascade em `Portfolio` e `BacktestRun`.                             |
| `Asset`          | `@@unique([symbol, exchange])`, enum `AssetType` (STOCK, ETF, CRYPTO, FX, INDEX, FUND, BOND, OTHER).|
| `Portfolio`      | `userId` FK cascade, `name`, `description?`.                                                       |
| `PortfolioAsset` | `targetWeight Decimal(12,8)?` **xor** `quantity Decimal(24,8)?`, `@@unique([portfolioId, assetId])`. |
| `Candle`         | `Decimal(18,8)` para OHLC, `Decimal(24,2)` para volume, `@@unique([assetId, interval, bucketStart])`. |
| `BacktestRun`    | guarda `summary` e `series` como `Json`, índices `(userId, createdAt)` e `assetId`.                |
| Enums            | `CandleInterval = DAY`, `BacktestStrategy = MOVING_AVERAGE_CROSSOVER`.                             |

---

## 2. Variáveis de ambiente (`src/lib/env.ts`)

Validadas por Zod no boot (falha rápido se faltar algo):

| Var                     | Tipo / default            | Uso                                                     |
| ----------------------- | ------------------------- | ------------------------------------------------------- |
| `NODE_ENV`              | `development\|test\|production` (default dev) | Não usado em runtime ainda                  |
| `PORT`                  | number (default 3333)     | Porta do Fastify                                        |
| `DATABASE_URL`          | string obrigatória        | Conexão Postgres                                        |
| `JWT_SECRET`            | string obrigatória        | Segredo do `@fastify/jwt`                               |
| `ALPHA_VANTAGE_API_KEY` | string obrigatória        | API key do provider de market data                      |
| `QUANTIX_BASE_URL`      | URL opcional              | Se vazio, `callQuantix` lança `QuantixUnavailableError` → fallback TS automático |
| `QUANTIX_TIMEOUT_MS`    | number positivo (default 30000) | Timeout via `AbortSignal.timeout`                |

---

## 3. Módulos por fase

### 3.1. Fase 1 — Foundation

- **Servidor de pé:** `tsx watch src/index.ts` sobe Fastify com logger JSON (pino default).
- **Health check:** `GET /health/` retorna `{ status: "ok", service, timestamp }`.
- **Prisma + Postgres:** singleton em `src/lib/prisma.ts` usando o adapter `PrismaPg`. `docker-compose.yml` sobe Postgres 16 com volume persistente.
- **Validação de env:** Zod schema com `.parse` em `src/lib/env.ts` (single source of truth tipada).
- **Error handler global:** trata `ZodError` (400) e delega o resto para o handler default do Fastify (`reply.send(error)`).

### 3.2. Fase 2 — Auth + Users

Tudo em `src/modules/auth` e `src/modules/users`.

| Endpoint              | Auth | Descrição                                                                         |
| --------------------- | ---- | --------------------------------------------------------------------------------- |
| `POST /auth/register` | não  | `{ name, email, password }` → cria user, retorna `{ user, token }` (status 201).  |
| `POST /auth/login`    | não  | `{ email, password }` → valida bcrypt, retorna `{ user, token }`.                 |
| `GET /users/me`       | JWT  | Retorna o usuário autenticado (a partir de `request.user.sub`).                   |

Validação: `registerBodySchema` exige `name (≥2)`, `email`, `password (≥6)`; `loginBodySchema` é só `email + password`.

Pipeline:

- `bcrypt.hash(password, 10)` no registro.
- `bcrypt.compare` no login.
- `reply.jwtSign({ sub, email })` em ambos.
- `authenticatePlugin` decora `app.authenticate` chamando `request.jwtVerify()`.
- Tipos do JWT estão em `src/@types/fastify-jwt.d.ts` (payload e user com `sub` + `email`).

### 3.3. Fase 3 — Assets

`src/modules/assets`:

| Endpoint                   | Auth | Comportamento                                                                                          |
| -------------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| `POST /assets/`            | JWT  | Cria ativo (`symbol`/`exchange` normalizados: trim + upper para symbol). 409 em conflito unique.       |
| `GET /assets/`             | JWT  | Filtros: `q` (busca insensitive em `symbol`/`name`), `exchange`, `type`, `skip`, `take` (1–100, default 50). Ordena por `exchange, symbol`. |
| `GET /assets/:id`          | JWT  | 404 se não existe.                                                                                     |
| `POST /assets/:id/sync-prices` | JWT | Sincroniza candles via Alpha Vantage (ver Fase 4).                                                  |
| `GET /assets/:id/prices`   | JWT  | Lista candles persistidos no intervalo (ver Fase 4).                                                   |
| `GET /assets/:id/metrics`  | JWT  | Métricas de retorno do ativo no intervalo (ver Fase 6).                                                |

Erros: `DuplicateAssetError` (P2002), `AssetNotFoundError`.

Repositório (`assets.repository.ts`): `createAsset`, `listAssets` (where dinâmico com `OR` por `symbol`/`name`), `findAssetById`, `findAssetBySymbolExchange`.

### 3.4. Fase 4 — Market Data

`src/modules/market-data`:

#### Provider plugável

Interface `MarketDataProvider`:

- `searchAssets(query)`
- `getQuote(symbol)`
- `getHistoricalPrices({ symbol, interval, from?, to? })` — retorna pontos com OHLCV (`bucketStart: Date`).

> Atualmente só `getHistoricalPrices` é exposto via API. `searchAssets` e `getQuote` estão implementados na Alpha Vantage mas sem rota.

#### Implementação Alpha Vantage (`alpha-vantage.provider.ts`)

- Endpoint base: `https://www.alphavantage.co/query`
- `TIME_SERIES_DAILY` para histórico, `outputsize=compact` (≤ ~100 dias) ou `full` (até ~20 anos), decidido por `pickOutputSize` (120 dias como threshold).
- Detecta rate limit em `Note` ou `Information` (regex case-insensitive de `frequency|rate limit|API key`) e em HTTP 429 — lança `MarketDataRateLimitedError` (HTTP 429).
- Hierarquia de erros (`market-data.errors.ts`):
  - `MarketDataProviderError` (`statusCode`, `code`)
  - `MarketDataRateLimitedError` (429, `MARKET_DATA_RATE_LIMITED`)
  - `MarketDataSymbolNotFoundError` (404, `MARKET_DATA_SYMBOL_NOT_FOUND`)
  - `MarketDataProviderResponseError` (502, `MARKET_DATA_PROVIDER_RESPONSE`)
  - Network errors → 502 com code `MARKET_DATA_NETWORK`.

#### Rotas

| Endpoint                       | Comportamento                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /assets/:id/sync-prices` | Query opcional `from`, `to`, `interval`. Se ambos vazios busca tudo; se algum existir, completa `from = to - 365d` ou `to = now`. Faz upsert. |
| `GET /assets/:id/prices`       | Query **obrigatória** `from`, `to`; `skip` (default 0), `take` (1–2000, default 500); `interval=DAY`.                                       |

#### Persistência (`candles.repository.ts`)

- `upsertCandles(assetId, interval, rows)` → `prisma.$transaction` com um `upsert` por linha.
- `listCandlesByAssetAndRange` → `findMany` com `take` capped em 2000.
- `listDailyClosesInRange` → query enxuta (`select: { bucketStart, close }`) capped em `ANALYTICS_MAX_CANDLES = 4000`.

### 3.5. Fase 5 — Portfolios

`src/modules/portfolios`:

| Endpoint                                    | Auth | Comportamento                                                                                            |
| ------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `POST /portfolios/`                         | JWT  | Cria carteira do usuário (`name`, `description?`).                                                       |
| `GET /portfolios/`                          | JWT  | Lista carteiras do usuário ordenadas por `updatedAt desc`.                                               |
| `GET /portfolios/:id`                       | JWT  | Detalhe **escopado pelo userId**, inclui posições + asset embutido.                                      |
| `POST /portfolios/:id/assets`               | JWT  | Adiciona posição: **exatamente um** entre `targetWeight (0–1]` ou `quantity (>0)` (Zod refine).          |
| `DELETE /portfolios/:id/assets/:assetId`    | JWT  | Remove posição (204). 404 se carteira ou posição não existir.                                            |
| `GET /portfolios/:id/metrics`               | JWT  | Métricas agregadas (ver Fase 6).                                                                         |

Erros próprios: `PortfolioNotFoundError`, `DuplicatePortfolioAssetError`, `PortfolioAssetNotFoundError`, `InvalidAllocationError` (declarado mas não usado).

Pontos importantes:

- `findPortfolioByIdForUser` faz `findFirst` com `where: { id, userId }` — boa proteção contra IDOR.
- `addPortfolioAssetService` valida posse, valida asset, converte para `Prisma.Decimal` e captura `P2002`.
- O Prisma `Decimal` é convertido para `number` na resposta (`Number(row.targetWeight)`).

### 3.6. Fase 6 — Analytics

`src/modules/analytics`:

#### Biblioteca de métricas (`metrics.ts`)

- `TRADING_DAYS_PER_YEAR = 252`
- `closesToSimpleReturns(closes)` → `r_t = P_t/P_{t-1} - 1` (lança se prev=0/não finito).
- `cumulativeReturnFromSimpleReturns` → `∏(1+r) - 1`.
- `wealthPathFromReturns` → caminho de riqueza normalizado (W₀=1).
- `maxDrawdownFromWealth` → `min(W_t / max_{s≤t} W_s) - 1` (≤ 0).
- `computeMaxDrawdownDurationPeriods` → distância em períodos do pico ao trough da maior queda.
- `sampleStdDev` com Bessel (n-1).
- `downsideDeviation` para Sortino (denominador n).
- `metricsFromSimpleDailyReturns(returns, riskFreeAnnual=0)` agrupa tudo, anualiza com `√252`.

> ⚠️ Cuidado: Sharpe e volatilidade usam `n-1` (sample), Sortino usa `n` (population) — convenção comum mas vale documentar.

#### Endpoints

| Endpoint                       | Query                       | Saída                                                                                  |
| ------------------------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| `GET /assets/:id/metrics`      | `from`, `to` obrigatórios   | `{ period, assumptions: { ..., engine: "quantix"\|"ts" }, metrics }`                   |
| `GET /portfolios/:id/metrics`  | idem                        | Igual + `allocationMode: "targetWeight"\|"quantity"`, `weightsNormalized: boolean`     |

- `metricsQuerySchema` exige `from ≤ to` e `to - from ≤ 4000 dias` (corresponde ao cap interno).
- `getAssetMetricsService` carrega closes, exige ≥ 2 pontos (`InsufficientPriceDataError`), chama `computeMetrics`.
- `getPortfolioMetricsService`:
  1. Valida posse + existência.
  2. Rejeita mistura de `targetWeight` e `quantity` → `MixedPortfolioAllocationError`.
  3. Rejeita múltiplas currencies → `CurrencyMismatchError` (422).
  4. Carrega closes de cada posição **em loop sequencial** (ver bug nº 8).
  5. Faz interseção de timestamps em `intersectionCloseMatrix` (Set intersection sobre `bucketStart.getTime()`).
  6. Se `targetWeight`: normaliza pesos para soma 1, calcula retorno ponderado por bar.
  7. Se `quantity`: retorno via mark-to-market do portfolio.
  8. Calcula métricas com `computeMetrics`.

### 3.7. Fase 7 — Backtests

`src/modules/backtests`:

#### Engine (`engine/moving-average-crossover.ts`)

Estratégia long/cash com regras explícitas no docstring:

- Sinal no bar `t` usa `SMA(fast)` vs `SMA(slow)` dos closes até `t` (requer `t ≥ slowPeriod - 1`).
- Posição `pos[t]` é aplicada no retorno do **próximo** bar (`P[t+1]/P[t] - 1`) — sem lookahead.
- Antes do warmup, `pos[t] = 0` (cash).
- Buy-and-hold investe capital integral a partir do bar `slowPeriod - 1` (alinha janelas comparáveis).
- `rollingSma` em O(n) com janela móvel; preenche com NaN antes de `period - 1`.

Saída:

```ts
type MovingAverageCrossoverResult = {
  summary: {
    warmupBars,
    firstSignalBarIndex,
    priceObservations,
    curvePoints,
    strategyTotalReturn,
    buyHoldTotalReturn,
    finalEquityStrategy,
    finalEquityBuyHold,
  };
  series: { bucketStart, strategyEquity, buyHoldEquity }[]; // começa em firstSignalIdx
};
```

#### Rotas

| Endpoint                          | Comportamento                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /backtests/moving-average`  | Roda e **persiste** em `BacktestRun` (status 201). Valida `slow > fast`, range ≤ 4000 dias.    |
| `GET /backtests/`                 | Lista runs do usuário sem `series` (apenas `summary`).                                         |
| `GET /backtests/:id`              | Detalhe completo (com `series`) escopado por `userId`.                                         |

Validação (`backtests.schemas.ts`): `assetId`, `from`, `to`, `initialCapital > 0`, `fastPeriod ≥ 2`, `slowPeriod ≥ 3`, `slow > fast`, range ≤ 4000 dias, `from ≤ to`.

Service:

- Carrega closes via `listDailyClosesInRange` (cap 4000).
- Exige `rows.length ≥ slowPeriod + 1` (`InsufficientHistoryForBacktestError`).
- Delega para `computeBacktestMa` (quantix ou TS fallback).
- Persiste `summary` e `series` como JSONB.
- Resposta inclui `assumptions` (interval=DAY, execução em close, posição long_or_cash, sinal no próximo bar, 252 dias úteis) e `limits` (`maxRangeDays`, `maxCandlesLoaded`).

### 3.8. Fase 8 — Integração com `quantix`

`src/lib/quantix`:

- **Protocolo** (`quantix-protocol.ts`):
  - `POST /metrics` → `{ returns, riskFreeAnnual } → ReturnSeriesMetrics`
  - `POST /backtest/moving-average` → `{ closes, dates, fastPeriod, slowPeriod, initialCapital } → MovingAverageCrossoverResult`
  - `GET /health`
- **Client** (`quantix-client.ts`):
  - Lança `QuantixUnavailableError` se `QUANTIX_BASE_URL` vazio, em erro de rede, timeout (`AbortSignal.timeout(QUANTIX_TIMEOUT_MS)`) ou não-2xx.
- **Wrappers com fallback automático:**
  - `computeMetrics` (`quantix-metrics.ts`)
  - `computeBacktestMa` (`quantix-backtest-ma.ts`)
  - Se a chamada falhar com `QuantixUnavailableError`, cai para a implementação TS. Qualquer outro erro propaga.
  - Devolvem `{ ..., engine: "quantix" | "ts" }` para o cliente saber qual motor rodou (refletido em `assumptions.engine` nas respostas).
- **Stub server** (`scripts/quantix-stub-server.ts`): Fastify standalone na porta 4000 que reusa as funções TS — útil para integração ponta-a-ponta sem o binário Rust pronto.

---

## 4. Tratamento de erros

Hoje há três níveis:

1. **Handler global** (`error-handler.ts`): trata só `ZodError → 400 { message, issues }`. Qualquer outro erro vira `reply.send(error)` (delegação para o handler default do Fastify, que normalmente retorna **500**).
2. **Try/catch local nas rotas**: cada handler mapeia erros de domínio para HTTP (404, 409, 422, 429, etc.). É repetitivo, mas funciona.
3. **Erros customizados** organizados por módulo (`AssetNotFoundError`, `PortfolioNotFoundError`, `MarketDataRateLimitedError`, etc.) — bom padrão, falta apenas convergir para um base class com `statusCode`.

---

## 5. Bugs e questões a corrigir

Lista priorizada (severidade decrescente).

### Críticos (segurança / correção)

#### B-1. Rotas de auth retornam 500 em erros esperados

`src/modules/auth/services/register.service.ts:11–13` e `login.service.ts:11,17` lançam `new Error("User already exists")` / `"Invalid credentials"`. As rotas em `src/modules/auth/routes.ts` **não fazem try/catch**, então o `error-handler.ts` global cai em `reply.send(error)` e devolve **500 Internal Server Error** — em vez de **409** (já existe) e **401** (credenciais inválidas).

Como corrigir: criar `EmailAlreadyTakenError` (409) e `InvalidCredentialsError` (401) e mapear nas rotas, ou (melhor) implementar um base `AppError` com `statusCode` e tratar no error-handler global.

#### B-2. JWT sem expiração

`reply.jwtSign({ sub, email })` (em `auth/routes.ts:12,32`) não passa `expiresIn`, então o token vale para sempre. Em caso de vazamento, não há revogação. Recomenda-se algo como `{ expiresIn: "15m" }` + refresh token, ou ao menos um TTL razoável.

#### B-3. Senha pode vazar no log

O Fastify com `logger: true` loga request bodies em alguns ambientes (e qualquer middleware/plugin pode logar). Como `/auth/register` e `/auth/login` recebem `password` em claro, é fácil acabar com a senha em log. Configurar `serializers.req` / `redact` do pino:

```ts
Fastify({
  logger: {
    redact: ['req.body.password', 'res.headers["set-cookie"]'],
  },
});
```

#### B-4. CORS totalmente aberto

`@fastify/cors` está com `origin: true`, que aceita qualquer origem com credenciais. Em produção, configurar uma whitelist (ex.: vinda de env `CORS_ORIGINS`).

#### B-5. Race condition no register

`registerUser` faz `findUserByEmail` → `bcrypt.hash` → `createUser`. Entre os dois passos, requests concorrentes podem passar pelo check. A constraint `email unique` no Postgres garante a integridade, mas o erro retornado vai ser 500 (P2002 não tratado). Tratar `Prisma.PrismaClientKnownRequestError.code === "P2002"` no `createUser` e converter para `EmailAlreadyTakenError`.

#### B-6. `.env.example` está no `.gitignore`

Linha 12 do `.gitignore` ignora `.env.example`. O propósito do arquivo é ser versionado — caso contrário ninguém clona o repo e sabe quais envs precisa. Remover `.env.example` do `.gitignore`.

### Importantes (correção / DX / performance)

#### B-7. Error handler global sem padrão consistente

Hoje toda rota repete try/catch porque o handler global só sabe lidar com Zod. Criar uma classe base `AppError { statusCode, code, message }` e fazer o handler global mapear automaticamente. Reduz repetição e elimina o risco de novas rotas esquecerem o try/catch (caso do B-1).

#### B-8. `getPortfolioMetricsService` faz N+1 sequencial

`get-portfolio-metrics.service.ts:62–74` itera com `for...of` e `await listDailyClosesInRange`. Para uma carteira com 10 posições e janelas longas, o tempo é dominado por round-trip ao DB. Trocar por `Promise.all(positions.map(...))`. Se a carga aumentar, considerar uma única query com `IN (assetIds)` agrupada por asset.

#### B-9. `upsertCandles` faz transação com N upserts

`candles.repository.ts:27–56` usa `prisma.$transaction([...upserts])`. Para um sync `full` (até ~5000 dias), são milhares de upserts num mesmo transaction — risco de timeout e bloqueio de tabela. Opções:

- `createMany({ skipDuplicates: true })` + `updateMany` separado.
- `prisma.$executeRaw` com `INSERT ... ON CONFLICT (...) DO UPDATE`.

#### B-10. Carteira sem allocation cai em mensagem confusa

Em `get-portfolio-metrics.service.ts:134–144`, se todas as posições têm `targetWeight = null` e `quantity = null` (cenário hoje só atingível por dados antigos, mas possível), o cálculo cai no ramo `quantity` com `Number(null) = 0` e termina com `InsufficientPriceDataError("Portfolio value is zero on an aligned date")` — mensagem enganosa. Validar explicitamente:

```ts
if (!hasWeight && !hasQty) throw new InvalidAllocationError("Portfolio has positions without allocation");
```

#### B-11. Truncamento silencioso de candles

`listDailyClosesInRange` (e indiretamente `listAssetPricesService` e backtests) usa `take: ANALYTICS_MAX_CANDLES (4000)` sem aviso ao cliente. Se o usuário pedir um range com mais de 4000 candles disponíveis, recebe métricas calculadas sobre janela cortada, sem indicação. Sugestão: retornar `truncated: true` no payload ou contar antes e rejeitar.

#### B-12. Endpoint `/me` vs `/users/me`

O roadmap (Fase 2) pede `GET /me`. A implementação está em `/users/me`. Não é bug funcional, mas vale alinhar (ou ao menos documentar a divergência). Se quiser manter o roadmap, registrar `usersRoutes` sem prefix ou expor um alias.

#### B-13. `searchAssets` e `getQuote` não expostos

A interface `MarketDataProvider` define os três métodos, e o Alpha Vantage implementa todos, mas só `getHistoricalPrices` é exposto via rota. Decidir se isso é intencional (cortar escopo) ou expor (`GET /market-data/search?q=...`).

#### B-14. `runMovingAverageCrossover` aceita closes inválidos

Se um close vier como `0` ou `NaN`, o cálculo `closes[i]/prev - 1` produz `Infinity`/`NaN` e contamina todo o resultado. Adicionar validação no início do engine (e em `closesToSimpleReturns` já há, mas o engine de backtest não usa essa função). Verificar e lançar `InsufficientHistoryForBacktestError("Invalid close in window")`.

#### B-15. `pos[i]` quando `fast === slow`

`pos[i] = f > s ? 1 : 0` — em empate vira cash. Comum como tie-breaker, mas documentar. Cuidado também com NaN nas SMAs antes do warmup: como `pos` é inicializado com 0 e o loop começa em `firstSignalIdx`, está OK, mas qualquer NaN nos closes contamina depois.

#### B-16. Logger sem pretty-print em dev

`logger: true` produz JSON em dev. Para a experiência local, registrar `pino-pretty`:

```ts
logger: env.NODE_ENV === "development"
  ? { transport: { target: "pino-pretty" } }
  : true
```

### Menores (qualidade / dívida da Fase 9)

#### B-17. `bcryptjs` + 10 rounds

Para produção, considerar `bcrypt` nativo (mais rápido) ou `argon2`. Subir rounds para 12 se manter bcryptjs.

#### B-18. `@fastify/sensible` registrado mas não usado

Registrado em `app.ts` mas nenhum `httpErrors` ou `assert` é usado. Decidir entre adotar ou remover.

#### B-19. `authenticatePlugin` com `app: any`

`src/app/plugins/authenticate.ts:4` recebe `app: any`. Tipar como `FastifyInstance` para ganhar checagem.

#### B-20. Tipos do Prisma `Decimal` em respostas

Em vários services (`addPortfolioAssetService`, `list-asset-prices`, `backtests`, etc.) o `Decimal` é convertido para `Number` na resposta JSON, perdendo precisão para casas decimais > ~15 dígitos. Para a maioria dos casos atuais (preços de ações), é OK. Para crypto e BTC com 8 casas, vale considerar enviar como string (`row.targetWeight.toString()`).

#### B-21. Falta rate limiting global

Não há proteção contra abuse (login brute force, sync-prices em loop, etc.). Adicionar `@fastify/rate-limit`.

#### B-22. Falta `helmet` / security headers

Sem `@fastify/helmet`, faltam headers como `X-Content-Type-Options`, `Strict-Transport-Security`, etc.

#### B-23. Diretórios `tests/unit` e `tests/integration` vazios

Roadmap Fase 9 pede testes. Sem nada hoje. Sugestão: começar por `metrics.ts` (puro, fácil), depois `moving-average-crossover.ts`, e por fim integração de `/auth/register` + `/auth/login`.

#### B-24. Sem ESLint config

`eslint` está em `devDependencies` mas não há `eslint.config.js` (nem `.eslintrc`). `npm run lint` provavelmente falha.

#### B-25. Falta OpenAPI/Swagger

Fase 9 pede. Adicionar `@fastify/swagger` + `@fastify/swagger-ui` e gerar specs a partir de Zod via `fastify-type-provider-zod`.

#### B-26. Falta retry/backoff no provider

Se a Alpha Vantage retornar 502 esporádico, hoje a sincronização falha por inteiro. Adicionar retry com backoff exponencial (idealmente após mover sync para job assíncrono).

#### B-27. Sem migration check no boot

Se o DB não estiver migrado, a aplicação sobe e quebra na primeira query. Considerar `prisma migrate deploy` no boot do container (ou pelo menos um warning).

#### B-28. `@types/node` ^25.5.2

Versão muito recente — confirmar compatibilidade com o Node do ambiente (recomendado Node 22 LTS ou 24).

#### B-29. Documentação inconsistente da convenção Sortino

Em `metrics.ts:140–155`, `downsideDeviation` divide por `n` (population), enquanto `sampleStdDev` divide por `n-1` (Bessel). É a convenção comum, mas vale registrar no docstring de `metricsFromSimpleDailyReturns` para que o `quantix` futuro mantenha o mesmo padrão e evite divergência de números entre engines.

#### B-30. `currencies` check só compara strings

`Set(positions.map(p => p.asset.currency))` rejeita carteiras com moedas misturadas — bom. Porém, conversão FX entre ativos com mesma "moeda" mas mercados diferentes (ex.: BRL B3 vs BRL outra exchange) não é considerada. Hoje OK porque o seed e a Alpha Vantage tratam tudo em close diário, mas vale anotar como limitação documentada.

---

## 6. Próximos passos sugeridos (alinhando com Fase 9)

Ordem que minimiza retrabalho:

1. **Fixar B-1, B-2, B-3, B-4, B-5, B-6** (todos críticos, todos pequenos).
2. **Implementar `AppError` + handler global** (B-7) — destrava todas as outras correções de erro.
3. **Adicionar ESLint config + Prettier** (B-24) antes dos testes, para não brigar com formatação depois.
4. **Testes unitários de `metrics.ts` e `moving-average-crossover.ts`** (B-23). Engenharia quant precisa disso para confiar nos números.
5. **Trocar `upsertCandles` por `INSERT ... ON CONFLICT`** (B-9). Impacto direto em latência da sync.
6. **Paralelizar `getPortfolioMetricsService`** (B-8).
7. **Swagger** (B-25) + redact no logger (B-3) + rate limit (B-21) + helmet (B-22).
8. **Documentar limitações** (B-11, B-29, B-30) em docstrings.

A partir daí, o projeto está pronto para a Fase 10 (jobs assíncronos com BullMQ + Redis, múltiplos providers, watchlists, métricas rolling).

---

## 7. Resumo executivo

- **O que está bem feito:** separação por módulos é consistente (`routes` → `service` → `repository`), tipagem forte, erros customizados por módulo, fallback elegante TS↔quantix com sinalização explícita no payload (`assumptions.engine`), stub server pronto para integração ponta-a-ponta, validação de domínio (xor entre weight/quantity, currency uniforme, limites de range).
- **O que mais dói hoje:** auth retornando 500 em erros esperados (B-1), JWT eterno (B-2) e CORS aberto (B-4) — em conjunto, qualquer demo pública já é arriscada.
- **O que mais paga depois:** consolidar `AppError + handler global` (B-7) e adicionar testes unitários da camada de métricas (B-23). Esses dois desbloqueiam Fase 9 sem trabalho extra.

