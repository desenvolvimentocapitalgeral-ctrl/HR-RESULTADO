module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada', nokey: true });

  const { entries, accounts, historico } = req.body || {};
  if (!entries || !entries.length) return res.status(400).json({ error: 'Sem lançamentos' });

  const accountList = (accounts || []).map(a => `${a.id} | ${a.label} | ${a.tipo}`).join('\n');
  const historicoStr = (historico || []).slice(0, 30)
    .map(l => `${l.data}|${l.desc}|${l.tipo}|${l.conta}|${l.valor}`).join('\n') || 'Sem histórico';

  const entriesStr = entries.map((e, i) => ({
    i,
    data: e.Data || e.data || e.DATE || '',
    hist: e.Histórico || e.historico || e.Descricao || e.HISTORICO || '',
    valor: e.Valor || e.valor || e.VALOR || 0
  }));

  const prompt = `Você é assistente financeiro especializado em fazendas de pecuária.
Classifique cada lançamento bancário nas contas do sistema.

PLANO DE CONTAS (id | nome | tipo):
${accountList}

HISTÓRICO RECENTE (data|desc|tipo|conta|valor):
${historicoStr}

LANÇAMENTOS BANCÁRIOS:
${JSON.stringify(entriesStr)}

Para cada lançamento retorne JSON com:
- i: índice
- conta_id: id da conta (ex: gado_corte, zoo_vet, pessoal, comp_gado)
- conta_label: nome legível da conta
- tipo: R (Receita), D (Despesa), I (Investimento), M (Mútuo)
- descricao: descrição gerencial (máx 50 chars)
- confianca: 0 a 100
- motivo: justificativa curta (máx 8 palavras)

Regras:
- Valor positivo = geralmente Receita (R)
- Valor negativo = geralmente Despesa (D) ou Investimento (I)
- PIX/TED recebido de pessoa = verificar se é receita operacional
- Folha/salário/pessoal = pessoal (D)
- Ração/medicamento/vacina = zoo_vet ou zoo_past (D)
- Compra de animais = comp_gado (I)
- Combustível/veículo = veiculos (D)
- Retorne APENAS JSON array válido, sem texto adicional.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Claude API error', detail: err });
    }

    const data = await response.json();
    const text = (data.content[0].text || '').trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Resposta inválida da IA', raw: text });

    const suggestions = JSON.parse(jsonMatch[0]);
    return res.json({ suggestions, tokens: data.usage });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
