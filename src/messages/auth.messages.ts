/** API copy for authentication flows (JSON responses). */
export const AUTH_MESSAGES = {
  registerAck:
    'Thank you. Please check your email to verify your address if further action is required.',
  emailVerifiedSuccess: 'Email verified successfully',
  loginSuccess: 'Login successful',
  forgotPasswordGeneric:
    'If an account exists for this email, you will receive password reset instructions shortly.',
} as const
