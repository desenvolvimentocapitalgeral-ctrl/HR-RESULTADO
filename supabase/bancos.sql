-- HR RESULTADO · Contas Bancárias
-- Cole no Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS contas_bancarias (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id    BIGINT,
  nome          TEXT NOT NULL,
  agencia       TEXT,
  conta         TEXT,
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON contas_bancarias;
CREATE POLICY "public_all" ON contas_bancarias FOR ALL USING (true) WITH CHECK (true);

-- Garante coluna de centro de custo e status nos lançamentos (já existem, mas por segurança)
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS centro_custo TEXT;
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';
