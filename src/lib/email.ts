import nodemailer from 'nodemailer'

import { env } from './env.js'

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

interface EmailProvider {
  send(options: SendEmailOptions): Promise<void>
}

/* ----------------------- SMTP / Nodemailer Provider ----------------------- */
async function createSmtpProvider(): Promise<EmailProvider> {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST ?? 'localhost',
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
  })

  return {
    async send(options: SendEmailOptions) {
      await transporter.sendMail({
        from: env.EMAIL_FROM ?? 'no-reply@example.com',
        to: Array.isArray(options.to) ? options.to.join(',') : (options.to as string),
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
    },
  } satisfies EmailProvider
}

let emailProviderInstance: EmailProvider | null = null

async function getEmailProvider(): Promise<EmailProvider> {
  if (!emailProviderInstance) {
    emailProviderInstance = await createSmtpProvider()
  }
  return emailProviderInstance
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const provider = await getEmailProvider()
  await provider.send(options)
}
