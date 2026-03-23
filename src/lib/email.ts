import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'TarefaApp <contato@melhoragencia.ai>'

export async function sendWelcomeEmail({
  to,
  name,
  planLabel,
}: {
  to: string
  name: string
  planLabel: string
}): Promise<void> {
  const subject = `🎉 Seu plano ${planLabel} está ativo — vamos começar!`
  const appUrl  = 'https://app.tarefa.app'
  const botPhone = '5531989507577'

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#128c7e;padding:20px 32px;text-align:center;">
              <img src="${appUrl}/logo.png" alt="TarefaApp" width="180" style="display:block;margin:0 auto;height:auto;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">Tudo pronto, ${name}! 🎉</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.5;">
                Seu plano <strong style="color:#128c7e;">${planLabel}</strong> foi ativado com sucesso.
                Agora é só criar sua conta e começar a organizar sua equipe.
              </p>

              <!-- CTA principal -->
              <div style="text-align:center;margin:0 0 32px;">
                <a href="${appUrl}"
                   style="display:inline-block;background:#128c7e;color:#fff;font-weight:700;font-size:16px;padding:15px 36px;border-radius:8px;text-decoration:none;">
                  Criar minha conta agora →
                </a>
                <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">
                  Use o email <strong>${to}</strong> para criar sua conta
                </p>
              </div>

              <!-- Próximos passos -->
              <p style="margin:0 0 14px;font-size:14px;color:#374151;font-weight:600;">Primeiros passos após criar a conta:</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${[
                  ['1', `Acesse <a href="${appUrl}" style="color:#128c7e;">${appUrl}</a> e crie sua conta com o email <strong>${to}</strong>`],
                  ['2', 'Configure o nome da sua empresa no onboarding (leva menos de 1 minuto)'],
                  ['3', 'Convide sua equipe em <strong>Membros</strong> — eles receberão o acesso por WhatsApp'],
                  ['4', 'Crie seus primeiros grupos e tarefas em <strong>Grupos</strong> e <strong>Tarefas</strong>'],
                ].map(([n, text]) => `
                <tr>
                  <td style="width:28px;vertical-align:top;padding-bottom:12px;">
                    <span style="display:inline-block;width:22px;height:22px;background:#128c7e;border-radius:50%;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:22px;">${n}</span>
                  </td>
                  <td style="padding-left:10px;padding-bottom:12px;font-size:14px;color:#374151;line-height:1.5;">${text}</td>
                </tr>`).join('')}
              </table>

              <!-- Dica WhatsApp -->
              <div style="background:#f0fdf9;border-left:4px solid #128c7e;border-radius:6px;padding:14px 18px;margin:24px 0 0;">
                <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#128c7e;">💬 Dica: gerencie pelo WhatsApp</p>
                <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">
                  Depois de criar os grupos, adicione o bot <strong>+55 31 9895-0757</strong> no seu grupo do WhatsApp
                  para criar e consultar tarefas direto pelo celular.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Dúvidas? Responda este e-mail ou fale pelo WhatsApp: <a href="https://wa.me/${botPhone}" style="color:#128c7e;text-decoration:none;">+55 31 9895-0757</a><br/>
                © ${new Date().getFullYear()} TarefaApp · <a href="${appUrl}" style="color:#128c7e;text-decoration:none;">app.tarefa.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const { error } = await resend.emails.send({ from: FROM, to, subject, html })
  if (error) throw new Error(error.message)
}

export async function sendInviteEmail({
  to,
  name,
  code,
  workspaceName,
  inviterName,
}: {
  to: string
  name: string
  code: string
  workspaceName?: string
  inviterName?: string
}): Promise<void> {
  const botPhone = '5531989507577' // número do TarefaApp no WhatsApp
  const subject = `Você foi convidado para o TarefaApp${workspaceName ? ` — ${workspaceName}` : ''}`

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#128c7e;padding:20px 32px;text-align:center;">
              <img src="https://app.tarefa.app/logo.png" alt="TarefaApp" width="180" style="display:block;margin:0 auto;height:auto;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111;">Olá, ${name}! 👋</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.5;">
                ${inviterName ? `<strong>${inviterName}</strong> convidou você` : 'Você foi convidado'} para usar o <strong>TarefaApp</strong>${workspaceName ? ` na equipe <strong>${workspaceName}</strong>` : ''}.
              </p>

              <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600;">
                Para ativar sua conta, envie o código abaixo para o WhatsApp do TarefaApp:
              </p>

              <!-- Código -->
              <div style="background:#f0fdf9;border:2px dashed #128c7e;border-radius:10px;padding:20px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Seu código de ativação</p>
                <p style="margin:0;font-size:34px;font-weight:700;color:#128c7e;letter-spacing:6px;font-family:monospace;">${code}</p>
                <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">Válido por 7 dias</p>
              </div>

              <!-- Passos -->
              <p style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:600;">Como ativar:</p>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${[
                  ['1', `Salve o número <strong>+${botPhone}</strong> como "TarefaApp" no seu WhatsApp`],
                  ['2', `Envie uma mensagem com o código: <strong style="font-family:monospace;color:#128c7e;">${code}</strong>`],
                  ['3', 'Pronto! Sua conta será ativada automaticamente'],
                ].map(([n, text]) => `
                <tr>
                  <td style="width:28px;vertical-align:top;padding-bottom:10px;">
                    <span style="display:inline-block;width:22px;height:22px;background:#128c7e;border-radius:50%;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:22px;">${n}</span>
                  </td>
                  <td style="padding-left:10px;padding-bottom:10px;font-size:14px;color:#374151;line-height:1.5;">${text}</td>
                </tr>`).join('')}
              </table>

              <!-- CTA -->
              <div style="text-align:center;margin:24px 0 8px;">
                <a href="https://wa.me/${botPhone}?text=${encodeURIComponent(code)}"
                   style="display:inline-block;background:#128c7e;color:#fff;font-weight:600;font-size:14px;padding:13px 28px;border-radius:8px;text-decoration:none;">
                  Abrir WhatsApp e ativar conta
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Se você não esperava este convite, pode ignorar este e-mail com segurança.<br/>
                © ${new Date().getFullYear()} TarefaApp · <a href="https://app.tarefa.app" style="color:#128c7e;text-decoration:none;">app.tarefa.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  })
  if (error) throw new Error(error.message)
}
