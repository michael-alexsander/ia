import 'dotenv/config'
import express from 'express'
import { handleWebhook } from './webhook'
import { iniciarCronJobs } from './cron'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json({ limit: '10mb' }))

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'tarefaapp-agent', ts: new Date().toISOString() })
})

app.post('/webhook', handleWebhook)

app.listen(PORT, () => {
  console.log(`✅ TarefaApp Agent rodando na porta ${PORT}`)
  iniciarCronJobs()
})
