import axios from 'axios'

const BASE   = process.env.EVOLUTION_URL!
const APIKEY = process.env.EVOLUTION_API_KEY!
const INST   = process.env.EVOLUTION_INSTANCE!

const api = axios.create({
  baseURL: BASE,
  headers: { apikey: APIKEY },
})

// Envia mensagem de texto
// `to` pode ser: número (5531XXXXXXXX) ou JID de grupo (XXXXX@g.us)
export async function sendText(to: string, text: string) {
  await api.post(`/message/sendText/${INST}`, {
    number: to,
    text,
  })
}
