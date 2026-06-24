# Plano

Vou implementar em duas fases. Cada item é independente — se algum não te interessar, diz antes de eu começar.

## Acrescentar

### 3. Evolução da margem ao longo do tempo
- Nova tabela `obra_snapshots_mensais` (obra_id, ano, mes, orcamento_total, custo_acumulado, faturado_acumulado, margem). Populada por uma função `snapshot_obras_mes()` chamada manualmente (botão em Relatórios) e/ou por cron mensal.
- Nova aba em `relatorios.tsx` → "Evolução de Margem" com gráfico linha por obra (margem % ao longo dos meses) e tabela de drift (margem inicial vs actual).

### 4. Anexos
- Bucket privado `anexos` no Storage.
- Nova tabela `anexos` (id, entidade, entidade_id, nome, path, mime, tamanho, uploaded_by, created_at) + RLS (admin/gestor + utilizadores da obra).
- Componente `<AnexosPanel entidade="lancamento|obra|fatura" entidadeId={...} />` com upload, listagem, download (signed URL), apagar.
- Integrar em: `EditPanel` de lançamentos, página de obra, faturas emitidas, fornecedores (contratos).

### 5. Notificações
- Tabela `notificacoes` (id, user_id, tipo, titulo, corpo, link, lida, created_at) + RLS por user_id.
- Função SQL `gerar_notificacoes()` que detecta:
  - Rubrica com gasto > 90% do orçamento → notifica responsáveis da obra.
  - Obra sem lançamento há > 30 dias → notifica encarregado e gestor.
  - Fatura emitida vencida (data_vencimento < hoje, estado != paga) → notifica admin/gestor.
- Sino no `AppLayout` com badge de não lidas + dropdown com lista. Marcar como lida no clique.
- Executada via cron diário (pg_cron) ou botão manual em Gestão.

## Alterar

### 1. Hierarquia de rubricas colapsável
- Em `gestao_.rubricas.tsx` e no painel de rubricas da obra: render em árvore com `Collapsible` por rubrica-pai, mostrando filhas indentadas. Estado de expansão em `useState`.

### 2. Filtro de período global em Relatórios
- Mover state `dataDe`/`dataAte` para o componente pai `relatorios.tsx` (URL search params via `validateSearch` + `Route.useSearch()`).
- Passar como props para `RelatorioPorCliente`, `RelatorioPorRubrica`, `RelatorioPorPeriodo`, dashboard, fornecedores. Cada componente filtra os seus dados.
- Barra fixa no topo com os 2 inputs de data + preset rápido (mês actual / trimestre / ano / personalizado).

### 3. Comparação homóloga em `RelatorioPorPeriodo`
- Adicionar selector de ano + checkbox "comparar com ano anterior".
- Quando ligado, gráfico mostra 2 linhas (ano N vs N-1) para facturação, custo e margem. Tabela com Δ% por mês.

### 4. UI de diff no audit log
- Em `gestao_.auditoria.tsx`, expandir cada linha para mostrar `dados_antes` vs `dados_depois` lado a lado, destacando só os campos que mudaram (verde adicionado, vermelho removido). Usar `react-diff-viewer-continued` ou diff manual chave-a-chave.

## Detalhes técnicos

- Migrations separadas por feature (snapshots, anexos, notificações).
- Storage bucket criado via `supabase--storage_create_bucket` (privado).
- Server functions para `gerar_notificacoes()` e `snapshot_obras_mes()` em `src/lib/jobs.functions.ts` com `requireSupabaseAuth` + check `is_admin_or_gestor`.
- Notificações: realtime opcional via Supabase channels (posso adicionar se quiseres updates em tempo real, senão refresca ao montar o sino).

## Ordem de execução sugerida

1. Alterar #1 (hierarquia) — rápido, só UI.
2. Alterar #2 (filtro global) — refactor pequeno.
3. Alterar #4 (diff auditoria) — só UI.
4. Acrescentar #4 (anexos) — base para outras features.
5. Acrescentar #5 (notificações).
6. Acrescentar #3 (snapshots de margem).
7. Alterar #3 (homóloga) — depende de termos histórico.

## Perguntas antes de avançar

- **Notificações em tempo real** (realtime) ou só refresh ao abrir o sino?
- **Snapshot de margem**: automático (cron mensal) ou só manual via botão?
- **Anexos**: limite de tamanho por ficheiro? (sugiro 10 MB) Tipos permitidos? (sugiro PDF, JPG, PNG, XLSX, DOCX)
- Se quiseres, posso saltar qualquer um — diz só "tira o X".
