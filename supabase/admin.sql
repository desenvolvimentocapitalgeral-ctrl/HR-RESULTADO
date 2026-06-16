-- HR RESULTADO · Portal Admin (logo, cores, chaves de IA)
-- Cole no Supabase → SQL Editor → Run

-- Logo (base64) e cor primária por empresa
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cor  TEXT;

-- Tabela de configurações globais (1 linha só) — chaves de IA
CREATE TABLE IF NOT EXISTS configuracoes (
  id             INT PRIMARY KEY DEFAULT 1,
  ia_engine      TEXT DEFAULT 'auto',   -- auto | gemini | groq | openrouter | keyword
  gemini_key     TEXT,
  groq_key       TEXT,
  openrouter_key TEXT,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cfg_single_row CHECK (id = 1)
);

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON configuracoes;
CREATE POLICY "public_all" ON configuracoes FOR ALL USING (true) WITH CHECK (true);

-- Linha inicial de configuração
INSERT INTO configuracoes (id, ia_engine)
SELECT 1, 'auto'
WHERE NOT EXISTS (SELECT 1 FROM configuracoes WHERE id = 1);
