import { useState } from 'react';
import { theme } from '@/src/lib/theme';
import { resetSupabaseCredentials, supabase } from '@/src/lib/supabase';
import { AlertCircle, Loader2, Inbox, Copy, Check, Database, RefreshCw, Terminal, LogOut, Clock } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
      <Loader2 className="w-10 h-10 animate-spin text-sky-600" />
      <p className="mt-4 text-sm font-medium text-slate-500">
        Carregando...
      </p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [clearingSession, setClearingSession] = useState(false);

  const isJwtError =
    message.toLowerCase().includes('jwt') ||
    message.toLowerCase().includes('token') ||
    message.toLowerCase().includes('future') ||
    message.toLowerCase().includes('claim');

  const isTableMissing =
    !isJwtError &&
    (message.toLowerCase().includes('relation') ||
      message.toLowerCase().includes('does not exist') ||
      message.toLowerCase().includes('clients') ||
      message.toLowerCase().includes('42p01') ||
      message.toLowerCase().includes('pgrst204') ||
      message.toLowerCase().includes('table'));

  const handleClearSession = async () => {
    setClearingSession(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erro ao sair do Supabase:', e);
    } finally {
      // Clear local storage auth keys if present
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('sb-') || key.includes('supabase'))) {
          localStorage.removeItem(key);
        }
      }
      window.location.reload();
    }
  };

  const sqlScript = `-- SCRIPT SQL PARA CRIAR AS TABELAS DO OFICINAPRO NO SUPABASE
-- Cole este código no "SQL Editor" do seu painel Supabase e clique em "RUN".

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mileage INTEGER,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HABILITAR SEGURANÇA POR LINHA (RLS) E PERMISSÕES
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ÍNDICES DE DESEMPENHO PARA CONSULTAS RÁPIDAS
CREATE INDEX IF NOT EXISTS idx_service_orders_order_date ON public.service_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_client_id ON public.service_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_vehicle_id ON public.service_orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);

DROP POLICY IF EXISTS "Acesso total clientes" ON public.clients;
CREATE POLICY "Acesso total clientes" ON public.clients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total veiculos" ON public.vehicles;
CREATE POLICY "Acesso total veiculos" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total ordens" ON public.service_orders;
CREATE POLICY "Acesso total ordens" ON public.service_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total itens" ON public.order_items;
CREATE POLICY "Acesso total itens" ON public.order_items FOR ALL USING (true) WITH CHECK (true);`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[350px] p-6 max-w-2xl mx-auto text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center shadow-xs">
        <AlertCircle className="w-8 h-8" />
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-black text-slate-900">
          {isJwtError
            ? 'Sessão Expirada ou Dessincronizada'
            : isTableMissing
            ? 'Tabelas do Banco de Dados Não Encontradas'
            : 'Erro ao Carregar Dados'}
        </h3>
        <p className="text-xs text-red-600 font-mono bg-red-50 p-3 rounded-xl border border-red-200 text-left overflow-x-auto max-w-full">
          {message}
        </p>
      </div>

      {isJwtError ? (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-left text-xs text-sky-950 space-y-3 w-full">
          <div className="flex items-center gap-2 font-bold text-sky-950">
            <Clock className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Por que esse erro ("JWT issued at future") acontece?</span>
          </div>
          <p className="text-sky-900/90 leading-relaxed">
            Esse erro do Supabase ocorre por dois motivos comuns:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sky-900 font-medium pl-1">
            <li>
              <strong>Token antigo salvo no navegador:</strong> O navegador manteve uma sessão de login anterior que foi revogada ou expirou.
            </li>
            <li>
              <strong>Relógio do computador/dispositivo:</strong> O relógio local está com alguns segundos de diferença em relação ao servidor do Supabase.
            </li>
          </ul>

          <div className="pt-2">
            <button
              onClick={handleClearSession}
              disabled={clearingSession}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {clearingSession ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Renovar Sessão / Entrar Novamente</span>
            </button>
          </div>
        </div>
      ) : isTableMissing ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left text-xs text-amber-900 space-y-3 w-full">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <Database className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Como Resolver Este Problema no Seu Supabase:</span>
          </div>
          <p className="text-amber-900/90 leading-relaxed">
            O projeto do Supabase foi conectado com sucesso, mas as tabelas do sistema (<strong>clients, vehicles, service_orders, order_items</strong>) ainda não foram criadas no banco de dados.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <button
              onClick={copySql}
              className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Script SQL Copiado!' : 'Copiar Script SQL para Criar Tabelas'}</span>
            </button>

            <button
              onClick={() => setShowSqlModal(!showSqlModal)}
              className="py-2.5 px-3 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-amber-600" />
              <span>Ver SQL</span>
            </button>
          </div>

          <ol className="list-decimal list-inside space-y-1 text-amber-900/90 text-[11px] font-medium pt-1 border-t border-amber-200/80">
            <li>Acesse seu painel no Supabase: <strong>supabase.com/dashboard</strong></li>
            <li>No menu lateral, clique em <strong>SQL Editor</strong> &gt; <strong>New Query</strong></li>
            <li>Cole o código SQL e clique no botão verde <strong>RUN</strong></li>
            <li>Volte aqui e clique em "Tentar Novamente"!</li>
          </ol>
        </div>
      ) : null}

      {showSqlModal && (
        <div className="w-full text-left bg-slate-950 text-slate-200 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto relative space-y-2 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-sky-400 font-bold">Código SQL de Inicialização:</span>
            <button
              onClick={copySql}
              className="px-2.5 py-1 bg-sky-600 text-white rounded-lg font-sans font-bold hover:bg-sky-500 cursor-pointer flex items-center gap-1"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <pre className="whitespace-pre-wrap">{sqlScript}</pre>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs shadow-md shadow-sky-600/20 transition-all cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar Novamente</span>
          </button>
        )}

        <button
          onClick={resetSupabaseCredentials}
          className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2"
        >
          <span>Usar Modo Local Sem Supabase</span>
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[250px] p-6 text-center bg-white rounded-xl border border-gray-100">
      <Inbox className="w-10 h-10 mb-3" style={{ color: theme.textMuted }} />
      <p className="text-sm" style={{ color: theme.textSecondary }}>
        {message}
      </p>
    </div>
  );
}

