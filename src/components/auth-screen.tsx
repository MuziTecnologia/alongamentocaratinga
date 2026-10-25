'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Flower2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Brand, Field } from './ui';

export function AuthScreen({
  recovery = false,
  initialMode = 'login',
  initialError = '',
  initialMessage = '',
  bookingSlug = 'alongamentoscaratinga',
}: {
  recovery?: boolean;
  initialMode?: 'login' | 'reset';
  initialError?: string;
  initialMessage?: string;
  bookingSlug?: string;
}) {
  const [mode, setMode] = useState(recovery ? 'new-password' : initialMode);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError),
    [message, setMessage] = useState(initialMessage);
  const [showPassword, setShowPassword] = useState(false),
    [canRecover, setCanRecover] = useState(!recovery);
  useEffect(() => {
    if (!recovery) return;
    getSupabase()
      ?.auth.getUser()
      .then(({ data }) => setCanRecover(Boolean(data.user)));
  }, [recovery]);
  const title =
    mode === 'reset'
      ? 'Vamos recuperar seu acesso.'
      : mode === 'new-password'
        ? 'Um novo começo.'
        : 'Que bom ter você aqui.';
  return (
    <div className="auth-layout">
      <div className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <Flower2 size={62} strokeWidth={0.7} />
          <span className="eyebrow">SEU TALENTO MERECE ESSE CUIDADO</span>
          <h1>
            Mais tempo
            <br />
            para fazer
            <br />
            <em>o que você ama.</em>
          </h1>
          <p>
            Uma agenda leve. Clientes por perto.
            <br />
            Seu negócio florescendo, do seu jeito.
          </p>
        </div>
        <span className="auth-story-footer">AlongamentosCaratinga · Cuidado em cada detalhe.</span>
      </div>
      <main className="auth-main">
        <Link href={`/agendar/${bookingSlug}`} className="auth-back">
          <ArrowLeft size={15} />
          Página de agendamento
        </Link>
        <div className="auth-form-wrap">
          <div className="auth-icon">
            <Flower2 size={31} strokeWidth={1} />
          </div>
          <span className="eyebrow">ACESSO ADMINISTRATIVO</span>
          <h2>{title}</h2>
          <p>
            {mode === 'reset'
              ? 'Informe o e-mail da conta administrativa para recuperar o acesso.'
              : mode === 'new-password'
                ? 'Escolha uma senha com pelo menos oito caracteres.'
                : 'Entre com a conta administrativa do studio.'}
          </p>
          {!isSupabaseConfigured && (
            <p className="form-note">O acesso ao studio está temporariamente indisponível.</p>
          )}
          {recovery && !canRecover ? (
            <div className="info-card">
              <LockKeyhole size={22} />
              <p>
                Abra o link recebido por e-mail para definir uma nova senha. Se ele expirou,
                solicite outro na tela de acesso.
              </p>
            </div>
          ) : (
            <form
              className="auth-form"
              action="/auth/credentials"
              method="post"
              onSubmit={() => setBusy(true)}
            >
              <input type="hidden" name="mode" value={mode} />
              {mode !== 'new-password' && (
                <Field label="Seu e-mail">
                  <div className="input-icon">
                    <Mail size={17} />
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="E-mail da conta administrativa"
                    />
                  </div>
                </Field>
              )}
              {mode !== 'reset' && (
                <Field label={mode === 'new-password' ? 'Nova senha' : 'Sua senha'}>
                  <div className="input-icon">
                    <LockKeyhole size={17} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      minLength={mode === 'login' ? 1 : 8}
                      maxLength={128}
                      placeholder="Sua senha de acesso"
                    />
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </Field>
              )}
              {mode === 'login' && (
                <a
                  href="/entrar?mode=reset"
                  className="text-button forgot-password"
                  onClick={(event) => {
                    event.preventDefault();
                    setMode('reset');
                    setMessage('');
                    setError('');
                  }}
                >
                  Esqueci minha senha
                </a>
              )}
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="success-message" role="status">
                  {message}
                </p>
              )}
              <button className="button primary full-width" disabled={busy} type="submit">
                {busy
                  ? 'Só um momento…'
                  : mode === 'reset'
                    ? 'Enviar link de recuperação'
                    : mode === 'new-password'
                      ? 'Salvar nova senha'
                      : 'Entrar no meu studio'}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {!recovery && mode !== 'login' && (
            <div className="auth-switch">
              <a
                href="/entrar"
                onClick={(event) => {
                  event.preventDefault();
                  setMode('login');
                  setError('');
                  setMessage('');
                }}
              >
                Voltar para entrar
              </a>
            </div>
          )}
          <div className="auth-security">
            <ShieldCheck size={14} />
            Acesso exclusivo à administração do studio.
          </div>
        </div>
      </main>
    </div>
  );
}
