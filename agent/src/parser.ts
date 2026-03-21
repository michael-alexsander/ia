import OpenAI from 'openai'
import { ParsedIntent } from './types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0]
  return `Você é um assistente de gerenciamento de tarefas via WhatsApp chamado TarefaApp.
Analise a mensagem do usuário e retorne APENAS um JSON com a intenção e entidades extraídas.

Data de hoje: ${today}

Intenções disponíveis:
- criar_tarefa: usuário quer criar uma nova tarefa
- listar_tarefas: usuário quer ver a lista de tarefas
- concluir_tarefa: usuário quer marcar uma tarefa como concluída (concluir, feito, pronto, done)
- atualizar_tarefa: usuário quer editar uma tarefa existente
- ajuda: usuário quer saber o que pode fazer
- desconhecido: não foi possível identificar a intenção

Formato de resposta (JSON válido):
{
  "intent": "criar_tarefa",
  "entities": {
    "titulo": "título da tarefa se mencionado",
    "responsavel": "nome do responsável se mencionado",
    "prazo": "YYYY-MM-DD se data mencionada",
    "grupo": "nome do grupo se mencionado",
    "task_id": "ID de 5 chars maiúsculos se mencionado (ex: AB123)",
    "status_filtro": "open|in_progress|done|all (só para listar)",
    "novo_status": "open|in_progress|done (só para atualizar)",
    "novo_titulo": "novo título se for atualização de título"
  },
  "confidence": 0.95
}

Regras:
- Inclua apenas as entidades que foram explicitamente mencionadas
- Interprete datas relativas: "amanhã", "sexta", "semana que vem" → data absoluta
- Para listar: sem filtro de status = mostrar abertas + em andamento
- IDs de tarefa são sempre 5 chars alfanuméricos maiúsculos`
}

export async function parseMessage(text: string): Promise<ParsedIntent> {
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 300,
    })

    const parsed = JSON.parse(resp.choices[0].message.content || '{}')
    return parsed as ParsedIntent
  } catch (err) {
    console.error('[parser] erro OpenAI:', err)
    return { intent: 'desconhecido', entities: {}, confidence: 0 }
  }
}
