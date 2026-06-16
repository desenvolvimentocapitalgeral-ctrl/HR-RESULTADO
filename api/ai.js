module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const geminiKey = process.env.GEMINI_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!geminiKey && !claudeKey) {
    return res.status(503).json({ error: 'Nenhuma chave de IA configurada', nokey: true });
  }

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

Para cada lançamento retorne um objeto JSON com:
- i: índice (número)
- conta_id: id da conta (ex: gado_corte, zoo_vet, pessoal, comp_gado)
- conta_label: nome legível da conta
- tipo: R (Receita), D (Despesa), I (Investimento), M (Mútuo)
- descricao: descrição gerencial (máx 50 chars)
- confianca: 0 a 100
- motivo: justificativa curta (máx 8 palavras)

Regras:
- Valor positivo = geralmente Receita (R)
- Valor negativo = geralmente Despesa (D) ou Investimento (I)
- Folha/salário/pessoal = pessoal (D)
- Ração/medicamento/vacina = zoo_vet ou zoo_past (D)
- Compra de animais = comp_gado (I)
- Combustível/veículo = veiculos (D)
- Retorne APENAS um array JSON válido, sem texto adicional, sem markdown.`;

  try {
    let text = '';

    // ── Opção 1: Google Gemini (plano gratuito) ──
    if (geminiKey) {
      const model = 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' }
        })
      });
      if (!r.ok) {
        const err = await r.text();
        return res.status(500).json({ error: 'Gemini API error', detail: err });
      }
      const data = await r.json();
      text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    // ── Opção 2: Claude (Anthropic, pago) ──
    } else {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!r.ok) {
        const err = await r.text();
        return res.status(500).json({ error: 'Claude API error', detail: err });
      }
      const data = await r.json();
      text = (data.content[0].text || '').trim();
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Resposta inválida da IA', raw: text });

    const suggestions = JSON.parse(jsonMatch[0]);
    return res.json({ suggestions, engine: geminiKey ? 'gemini' : 'claude' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
