import { VERIFICATION_EMAIL_MESSAGES } from '../messages/verification-email.messages.js'

/**
 * Builds subject and bodies for the registration / email-verification message.
 * @param verifyUrl - Full URL including hash fragment with the token (caller builds it).
 */
export function buildVerificationEmailTemplate(verifyUrl: string): {
  subject: string
  html: string
  text: string
} {
  const m = VERIFICATION_EMAIL_MESSAGES
  const subject = m.subject
  const text = [m.thankYou, '', m.openLinkInstruction, verifyUrl, '', m.ignoreIfNotYou].join('\n')
  const html = [
    `<p>${m.thankYou}</p>`,
    `<p><a href="${verifyUrl}">${m.linkLabel}</a></p>`,
    `<p>${m.expiresNote}</p>`,
    `<p>${m.ignoreIfNotYou}</p>`,
  ].join('')
  return { subject, html, text }
}
