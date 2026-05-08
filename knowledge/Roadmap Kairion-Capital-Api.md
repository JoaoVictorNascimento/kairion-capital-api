Etapas:
1. **Foundation**
2. **Auth + Users**
3. **Assets + Market Data**
4. **Portfolios**
5. **Analytics**
6. **Backtests**
7. **Integração com `quantix`**
8. Infra / qualidade


---
# Fase 1 — Foundation

Objetivo: deixar a API “de pé” e pronta para crescer.

## Entregas

- estrutura de pastas
- Fastify rodando
- Prisma conectado
- Postgres rodando
- health check
- env validation com Zod
- tratamento global de erro
- logger básico

## Resultado

Você consegue subir a API, acessar `/health` e ter base para novos módulos.


---

# Fase 2 — Auth + Users

Objetivo: transformar em sistema real, não só playground.

## Entregas

- model `User`
- `POST /auth/register`
- `POST /auth/login`
- hash de senha com `bcryptjs`
- JWT
- middleware de autenticação
- `GET /me`

## Resultado

Usuário consegue criar conta, logar e acessar rota protegida.

## Justificativa

Porque quase tudo depois depende de dono:

- carteira pertence a usuário
- backtest pertence a usuário
- watchlist pertence a usuário

---
# Fase 3 — Assets

Objetivo: criar o catálogo de ativos.

## Entregas

- model `Asset`
- campos como:
    - `symbol`
    - `name`
    - `type`
    - `exchange`
    - `currency`
- rotas:
    - `POST /assets`
    - `GET /assets`
    - `GET /assets/:id`
- seed inicial de alguns ativos

## Resultado

Você já tem ativos persistidos e uma base para market data.

---
# Fase 4 — Market Data

Objetivo: trazer o projeto para o mundo real.

## Entregas

- model `PriceHistory` ou `Candle`
- provider abstraction
- primeiro provider real
- rota para sincronizar preços
- rota para consultar histórico

## Exemplo de escopo

- `POST /assets/:symbol/sync-prices`
- `GET /assets/:symbol/prices?from=...&to=...`

## Sugestão de implementação

Criar interface do provider tipo:

- `searchAssets`
- `getQuote`
- `getHistoricalPrices`

E implementar um primeiro provider.

## Resultado

Você já consegue alimentar a plataforma com dados de mercado.

---
# Fase 5 — Portfolios

Objetivo: sair de “dados de mercado” e entrar em “produto de investimento”.

## Entregas

- model `Portfolio`
- model `PortfolioAsset`
- criação de carteira
- adicionar/remover ativos
- definir pesos ou quantidades
- listar carteiras do usuário

## Rotas

- `POST /portfolios`
- `GET /portfolios`
- `GET /portfolios/:id`
- `POST /portfolios/:id/assets`
- `DELETE /portfolios/:id/assets/:assetId`

## Resultado

Usuário já monta uma carteira dentro da plataforma.

---
# Fase 6 — Analytics

Objetivo: começar a mostrar valor quantitativo.

## Entregas

- endpoint de métricas por ativo
- endpoint de métricas por carteira
- retorno acumulado
- volatilidade
- volatilidade anualizada
- sharpe
- sortino
- max drawdown
- drawdown duration

## Resultado

Resultado promissor para demo e portfólio.

---

# Fase 7 — Backtests

## Entregas

- model `BacktestRun`
- endpoint para rodar estratégia
- moving average crossover
- capital inicial
- período
- persistência do resultado
- equity curve
- comparação com buy and hold

## Rotas

- `POST /backtests/moving-average`
- `GET /backtests`
- `GET /backtests/:id`

## Resultado

A plataforma já parece produto sério de research/backtesting.

---
# Fase 8 — Integração com `quantix`

Objetivo: colocar seu diferencial técnico no centro.

## Caminho mais pragmático

Para começar, eu escolheria um destes:

### opção A

**microservice Rust**

- API Node chama um serviço Rust HTTP

### opção B

**CLI bridge**

- Node chama um binário Rust com JSON

### opção C

**N-API**

- mais elegante, mas mais complexa

Para começar, eu iria de:

- **CLI bridge**, se quiser velocidade
- **microservice**, se quiser arquitetura mais bonita

## Resultado esperado

As métricas e backtests deixam de ser “lógica JS” e passam a ser powered by `quantix`.


---
# Fase 9 — Infra e qualidade

Objetivo: fazer o projeto parecer maduro.

## Entregas

- ESLint + Prettier bem ajustados
- testes unitários
- testes de integração
- Docker Compose
- seeds
- Swagger/OpenAPI
- tratamento consistente de erros
- validação de request/response

## Ordem interna

1. error handler
2. testes de auth
3. testes de assets
4. testes de portfolios
5. documentação OpenAPI


---
# Fase 10 — Evoluções futuras

## Dados

- sync agendado
- múltiplos providers
- cache
- retry/fallback

## Produto

- watchlists
- benchmark comparison
- alertas
- ranking de ativos

## Quant

- múltiplas estratégias
- custos operacionais
- slippage
- rebalanceamento
- métricas rolling

## Infra

- BullMQ + Redis
- jobs assíncronos
- observabilidade
- CI/CD

---

Project: #project/kairion-capital 
Areas: #area/personal-projects 
Subject: #subject/financial 
Type: #type/roadmap
Related:[[Project Kairion-capital-api]]