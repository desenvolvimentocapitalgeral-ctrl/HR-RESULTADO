module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const { entries, accounts, historico, keys = {}, engine = 'auto' } = body;
  if (!entries || !entries.length) return res.status(400).json({ error: 'Sem lançamentos' });

  // Chaves: prioridade para as do portal (Supabase), senão env vars do Vercel
  const geminiKey     = keys.gemini     || process.env.GEMINI_API_KEY     || '';
  const groqKey       = keys.groq       || process.env.GROQ_API_KEY       || '';
  const openrouterKey = keys.openrouter || process.env.OPENROUTER_API_KEY || '';
  const claudeKey     = process.env.ANTHROPIC_API_KEY || '';

  // Decide qual motor usar
  let useEngine = engine;
  if (engine === 'auto') {
    if (geminiKey) useEngine = 'gemini';
    else if (groqKey) useEngine = 'groq';
    else if (openrouterKey) useEngine = 'openrouter';
    else if (claudeKey) useEngine = 'claude';
    else useEngine = 'none';
  }
  if (useEngine === 'none' || (useEngine === 'gemini' && !geminiKey) ||
      (useEngine === 'groq' && !groqKey) || (useEngine === 'openrouter' && !openrouterKey) ||
      (useEngine === 'claude' && !claudeKey)) {
    return res.status(503).json({ error: 'Nenhuma chave de IA configurada', nokey: true });
  }

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

    if (useEngine === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
      const r = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' }
        })
      });
      if (!r.ok) return res.status(500).json({ error: 'Gemini API error', detail: await r.text() });
      const data = await r.json();
      text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    } else if (useEngine === 'groq') {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + groqKey },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt + '\n\nResponda com um objeto JSON {"itens": [...]}.' }]
        })
      });
      if (!r.ok) return res.status(500).json({ error: 'Groq API error', detail: await r.text() });
      const data = await r.json();
      text = (data.choices?.[0]?.message?.content || '').trim();

    } else if (useEngine === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + openrouterKey },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!r.ok) return res.status(500).json({ error: 'OpenRouter API error', detail: await r.text() });
      const data = await r.json();
      text = (data.choices?.[0]?.message?.content || '').trim();

    } else if (useEngine === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] })
      });
      if (!r.ok) return res.status(500).json({ error: 'Claude API error', detail: await r.text() });
      const data = await r.json();
      text = (data.content[0].text || '').trim();
    }

    // Extrai o array JSON (pode vir embrulhado em objeto {"itens":[...]})
    let suggestions = null;
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      suggestions = JSON.parse(arrMatch[0]);
    } else {
      const obj = JSON.parse(text);
      suggestions = obj.itens || obj.items || obj.lancamentos || [];
    }
    if (!Array.isArray(suggestions)) return res.status(500).json({ error: 'Resposta inválida da IA', raw: text });

    return res.json({ suggestions, engine: useEngine });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
