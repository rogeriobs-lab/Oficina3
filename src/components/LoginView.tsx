import React, { useState } from 'react';
import { useAuth } from '@/src/lib/auth';
import { getSupabaseCredentials, resetSupabaseCredentials } from '../lib/supabase';
import SettingsView from './SettingsView';
import { Wrench, Mail, Lock, AlertCircle, Loader2, ShieldCheck, ArrowRight, Settings, RefreshCw, X } from 'lucide-react';

export default function LoginView() {
  const { signIn, signUp } = useAuth();
  const credentials = getSupabaseCredentials();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) throw new Error(signUpError);
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw new Error(signInError);
      }
    } catch (err: any) {
      let rawMsg = err.message || '';
      if (rawMsg.includes('Invalid login credentials')) {
        rawMsg = 'A conexão com o Supabase está OK, mas este e-mail ainda não está cadastrado ou a senha está incorreta. Se esta é a primeira vez acessando este projeto no Supabase, mude para "Cadastre-se" abaixo para criar seu usuário!';
      } else if (rawMsg.includes('Email not confirmed')) {
        rawMsg = 'Sua conta foi criada no Supabase! Verifique a caixa de entrada do seu e-mail para confirmar o cadastro antes de entrar.';
      }
      setError(rawMsg || 'Ocorreu um erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@oficinapro.com');
    setPassword('123456');
    setIsSignUp(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Decorative Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-3xl shadow-2xl p-8 sm:p-10 backdrop-blur-xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-sky-400 p-0.5 shadow-lg shadow-sky-500/20 mb-4">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Wrench className="w-6 h-6 text-sky-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">OficinaPro</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 text-center">
            {isSignUp
              ? 'Informe seu e-mail para cadastrar um novo operador'
              : 'Entre com suas credenciais de acesso à oficina'}
          </p>
        </div>

        {error && (
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-300 text-xs font-semibold animate-scale-up">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p>{error}</p>
                {credentials.url && (
                  <p className="text-[11px] text-red-400 font-normal">
                    Servidor atual: <code className="bg-slate-950 px-1 py-0.5 rounded">{credentials.url}</code>
                  </p>
                )}
              </div>
            </div>

            {/* Special box for localhost / email confirmation issue */}
            {error.includes('Verifique a caixa de entrada') && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-xs space-y-2.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Por que deu erro de "localhost" ao clicar no link do e-mail?</span>
                </div>
                <p className="text-amber-200/90 leading-relaxed">
                  Por padrão, o Supabase direciona o link de confirmação para <code>localhost:3000</code>. Como você está usando este app na nuvem, o link de e-mail falha ao abrir.
                </p>
                <div className="space-y-1.5 pt-1 border-t border-amber-500/20">
                  <p className="font-bold text-white">Como resolver rápido para entrar agora:</p>
                  <ol className="list-decimal list-inside space-y-1 text-amber-100/90 pl-1">
                    <li>Acesse o <strong>Supabase Dashboard</strong> &gt; <strong>Authentication</strong> &gt; <strong>Users</strong></li>
                    <li>Localize o seu e-mail e clique em <strong>"Confirm Email"</strong> (ou <strong>"Auto-confirm"</strong>)</li>
                    <li>Retorne aqui e clique em <strong>"Entrar no Sistema"</strong>!</li>
                  </ol>
                </div>
                <div className="pt-1.5 border-t border-amber-500/20 text-[11px] text-amber-300/80">
                  💡 <strong>Dica de Desenvolvimento:</strong> No Supabase em <strong>Authentication &gt; Providers &gt; Email</strong>, você pode desmarcar a opção <em>"Confirm email"</em>. Assim os novos cadastros entram na hora sem precisar de e-mail!
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!isSignUp && !error.includes('Verifique a caixa de entrada') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                  <span>Mudar para "Cadastre-se" e Criar esta Conta</span>
                </button>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="flex-1 py-2 px-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurações</span>
                </button>

                <button
                  type="button"
                  onClick={resetSupabaseCredentials}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  title="Limpar Supabase e usar Banco Local"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resetar Modo Local</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              E-mail do Operador
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
                placeholder="operador@oficinapro.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl text-sm font-black text-slate-950 bg-sky-400 hover:bg-sky-300 transition-all shadow-lg shadow-sky-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                'Finalizar Cadastro'
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {!isSignUp && (
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full py-3 px-4 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-extrabold hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Usar Conta de Teste Demonstração</span>
              </button>
            )}
          </div>
        </form>

        <div className="text-center pt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="block w-full text-xs font-bold text-sky-400 hover:text-sky-300 hover:underline transition-colors cursor-pointer"
          >
            {isSignUp ? 'Já tem uma conta? Clique aqui para entrar' : 'Não tem conta ainda? Cadastre-se em segundos'}
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer pt-2"
          >
            <Settings className="w-3.5 h-3.5 text-sky-400" />
            <span>Configurações & Credenciais Supabase</span>
          </button>
        </div>
      </div>

      {/* Settings Modal overlay when on Login screen */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden relative my-8">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 z-20 p-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer shadow-lg"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
              <SettingsView />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

