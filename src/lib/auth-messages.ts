export const authErrors: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos. Confira e tente novamente.',
  user_already_exists: 'Já existe uma conta com esse e-mail. Use a opção Entrar.',
  email_exists: 'Já existe uma conta com esse e-mail. Use a opção Entrar.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.',
  signup_disabled: 'Novos cadastros estão desativados neste projeto Supabase.',
  account_not_allowed: 'O acesso ao painel é exclusivo da conta administrativa do studio.',
  email_address_invalid: 'Informe um endereço de e-mail válido.',
  weak_password: 'Use uma senha com pelo menos oito caracteres e siga os requisitos do projeto.',
  over_email_send_rate_limit:
    'O limite de e-mails do Supabase foi atingido. Aguarde antes de tentar novamente.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  validation_failed:
    'Confira seu e-mail e sua senha. Novas senhas precisam de pelo menos oito caracteres.',
  not_configured: 'O Supabase ainda não foi configurado no servidor.',
  invalid_link: 'Esse link de acesso expirou ou é inválido. Solicite um novo link.',
  request_failed: 'Não foi possível concluir o acesso. Tente novamente em instantes.',
};
export const authMessages: Record<string, string> = {
  confirm_email:
    'Confira seu e-mail para confirmar a conta. Depois, volte para entrar no seu studio.',
  recovery_sent:
    'Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.',
};
export function safeAuthError(code?: string) {
  return code && Object.hasOwn(authErrors, code) ? code : 'request_failed';
}
