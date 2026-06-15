-- HR RESULTADO · Supabase Schema
-- Cole este SQL no Supabase → SQL Editor → Run

-- Tabela de lançamentos
CREATE TABLE IF NOT EXISTS lancamentos (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  data         DATE        NOT NULL,
  descricao    TEXT        NOT NULL,
  conta        TEXT,
  centro_custo TEXT,
  tipo         CHAR(1),          -- R=Receita D=Despesa I=Investimento M=Mútuo
  banco        TEXT,
  valor        DECIMAL(15,2),
  obs          TEXT,
  status       TEXT DEFAULT 'pendente',
  ano          INT,
  mes          INT,
  dia          INT
);

-- Tabela de valores do fluxo de caixa (células)
CREATE TABLE IF NOT EXISTS fluxo_caixa (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ano      INT  NOT NULL,
  mes      INT  NOT NULL,
  dia      INT  NOT NULL,
  row_id   TEXT NOT NULL,
  valor    DECIMAL(15,2) DEFAULT 0,
  UNIQUE(ano, mes, dia, row_id)
);

-- Tabela de resultados de conciliação
CREATE TABLE IF NOT EXISTS conciliacao (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  data_banco       TEXT,
  historico_banco  TEXT,
  valor_banco      DECIMAL(15,2),
  desc_gerencial   TEXT,
  valor_gerencial  DECIMAL(15,2),
  score            INT,
  status           TEXT   -- ok | diff | dup | miss
);

-- Habilitar Row Level Security (leitura pública, escrita autenticada)
ALTER TABLE lancamentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fluxo_caixa  ENABLE ROW LEVEL SECURITY;
ALTER TABLE conciliacao  ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode ler e escrever via chave anon
CREATE POLICY "public_all" ON lancamentos  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON fluxo_caixa  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON conciliacao  FOR ALL USING (true) WITH CHECK (true);
