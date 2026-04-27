/** Copy for the registration verification email (HTML and plain text). */
export const VERIFICATION_EMAIL_MESSAGES = {
  subject: 'Verify your email address',
  thankYou: 'Thank you for registering.',
  openLinkInstruction:
    'Open this link in your browser to verify your email (link expires in 24 hours):',
  linkLabel: 'Verify your email address',
  expiresNote: 'This link expires in 24 hours.',
  ignoreIfNotYou: 'If you did not create an account, you can ignore this message.',
} as const

export const PASSWORD_RESET_EMAIL_MESSAGES = {
  subject: 'Reset your password',
  resetPasswordInstruction: 'Click the link below to reset your password:',
  linkLabel: 'Reset your password',
  ignoreIfNotYou: 'If you did not request a password reset, you can ignore this message.',
} as const
