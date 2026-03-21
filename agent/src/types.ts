export type Intent =
  | 'criar_tarefa'
  | 'listar_tarefas'
  | 'concluir_tarefa'
  | 'atualizar_tarefa'
  | 'ajuda'
  | 'desconhecido'

export interface ParsedIntent {
  intent: Intent
  entities: {
    titulo?: string
    responsavel?: string   // nome do membro responsável
    prazo?: string         // data no formato YYYY-MM-DD
    grupo?: string         // nome do grupo
    task_id?: string       // ID de 5 chars, ex: AB123
    status_filtro?: 'open' | 'in_progress' | 'done' | 'all'
    novo_status?: 'open' | 'in_progress' | 'done'
    hora?: string             // HH:MM — horário da tarefa
    novo_titulo?: string
    novo_prazo?: string
    novo_responsavel?: string
    nova_hora?: string        // HH:MM — novo horário ao atualizar
  }
  confidence: number
}

export interface MsgContext {
  workspaceId: string
  memberId: string
  memberName: string
  memberRole: 'admin' | 'member'
  senderPhone: string       // ex: 5531XXXXXXXXX
  remoteJid: string         // JID destino da resposta
  isGroup: boolean
  groupWhatsappId?: string  // JID do grupo WhatsApp
  instanceName: string
}
