-- HR RESULTADO · Multi-Empresa
-- Cole este SQL no Supabase → SQL Editor → Run
-- (pode rodar mesmo se já tiver dados; usa IF NOT EXISTS)

-- 1. Tabela de empresas
CREATE TABLE IF NOT EXISTS empresas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  nome        TEXT NOT NULL,
  cnpj        TEXT,
  responsavel TEXT,
  obs         TEXT,
  ativa       BOOLEAN DEFAULT TRUE
);

-- 2. Adiciona empresa_id nas tabelas de dados
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS empresa_id BIGINT;
ALTER TABLE fluxo_caixa ADD COLUMN IF NOT EXISTS empresa_id BIGINT;
ALTER TABLE conciliacao ADD COLUMN IF NOT EXISTS empresa_id BIGINT;

-- 3. Recria a restrição única do fluxo incluindo empresa_id
--    (assim cada empresa tem seu próprio fluxo de caixa independente)
ALTER TABLE fluxo_caixa DROP CONSTRAINT IF EXISTS fluxo_caixa_ano_mes_dia_row_id_key;
ALTER TABLE fluxo_caixa DROP CONSTRAINT IF EXISTS fluxo_caixa_emp_uniq;
ALTER TABLE fluxo_caixa ADD CONSTRAINT fluxo_caixa_emp_uniq
  UNIQUE(empresa_id, ano, mes, dia, row_id);

-- 4. RLS para empresas
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON empresas;
CREATE POLICY "public_all" ON empresas FOR ALL USING (true) WITH CHECK (true);

-- 5. Empresa inicial (para não começar vazio) — só insere se a tabela estiver vazia
INSERT INTO empresas (nome, cnpj, responsavel)
SELECT 'Minha Fazenda', '', 'Administrador'
WHERE NOT EXISTS (SELECT 1 FROM empresas);

-- 6. Vincula dados existentes (sem empresa) à primeira empresa
UPDATE lancamentos SET empresa_id = (SELECT MIN(id) FROM empresas) WHERE empresa_id IS NULL;
UPDATE fluxo_caixa SET empresa_id = (SELECT MIN(id) FROM empresas) WHERE empresa_id IS NULL;
