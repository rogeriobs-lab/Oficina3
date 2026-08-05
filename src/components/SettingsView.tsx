import React, { useState } from 'react';
import RecordDeletionManager from './RecordDeletionManager';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  exportAllDataBackup,
  exportSqlBackup,
  importDataBackup,
  syncLocalToSupabase,
  generateQuickConnectUrl,
  clearAllDatabaseData,
} from '../lib/supabase';
import {
  Database,
  Cloud,
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Key,
  Globe,
  Save,
  Trash2,
  Info,
  ShieldCheck,
  FileCode,
  FileJson,
  Loader2,
  Smartphone,
  Laptop,
  Share2,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react';

export default function SettingsView() {
  const credentials = getSupabaseCredentials();
  const [url, setUrl] = useState(credentials.url || '');
  const [key, setKey] = useState(credentials.key || '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingSql, setExportingSql] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [clearing, setClearing] = useState(false);

  const handleClearAllData = async () => {
    if (confirm('ATENÇÃO: Você tem certeza que deseja APAGAR TODOS os clientes, veículos e serviços/ordens cadastrados no sistema? Esta ação não poderá ser desfeita.')) {
      setClearing(true);
      const res = await clearAllDatabaseData();
      setClearing(false);
      if (res.success) {
        setImportStatus(res.message);
        setErrorStatus(null);
      } else {
        setErrorStatus(res.message);
      }
    }
  };

  const handleCopyQuickLink = () => {
    const quickLink = generateQuickConnectUrl();
    if (quickLink) {
      navigator.clipboard.writeText(quickLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleShareWhatsApp = () => {
    const quickLink = generateQuickConnectUrl();
    if (quickLink) {
      const message = encodeURIComponent(`📱 Link de Conexão Nuvem para o OficinaPro:\n\nAbra este link no celular para conectar automaticamente ao banco Supabase:\n${quickLink}`);
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  const handleSyncToCloud = async () => {
    setSyncingCloud(true);
    try {
      const result = await syncLocalToSupabase();
      setImportStatus(`Sucesso! ${result.count} registros enviados do computador para o banco do Supabase.`);
      setErrorStatus(null);
    } catch (err: any) {
      setErrorStatus(err.message || 'Erro ao enviar dados para o Supabase.');
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      saveSupabaseCredentials(url, key);
      setSavedSuccess(true);
      setErrorStatus(null);
    } catch (err: any) {
      setErrorStatus(err.message || 'Erro ao salvar credenciais.');
    }
  };

  const handleDisconnectSupabase = () => {
    if (confirm('Deseja realmente desconectar as credenciais do Supabase? O sistema voltará ao modo local.')) {
      saveSupabaseCredentials('', '');
    }
  };

  const handleExportJson = async () => {
    setExportingJson(true);
    try {
      await exportAllDataBackup();
      setImportStatus('Backup JSON gerado e baixado no seu dispositivo!');
      setErrorStatus(null);
    } catch (err: any) {
      setErrorStatus('Erro ao exportar backup em JSON.');
    } finally {
      setExportingJson(false);
    }
  };

  const handleExportSql = async () => {
    setExportingSql(true);
    try {
      await exportSqlBackup();
      setImportStatus('Script SQL do banco gerado e baixado no seu dispositivo!');
      setErrorStatus(null);
    } catch (err: any) {
      setErrorStatus('Erro ao exportar backup em SQL.');
    } finally {
      setExportingSql(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        await importDataBackup(json);
        setImportStatus('Backup restaurado com sucesso! Recarregando página...');
        setErrorStatus(null);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (err: any) {
        setErrorStatus('Falha ao processar arquivo de backup. Verifique se é um arquivo JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="w-48 h-48 text-sky-400" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Configurações & Banco de Dados
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Gerenciamento de Dados e Conexão Supabase
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Conecte sua conta do <strong>Supabase</strong> para sincronizar seus clientes, veículos e ordens de serviço diretamente na nuvem, garantindo que seus lançamentos nunca se percam.
          </p>
        </div>
      </div>

      {/* Current Connection Status Badge */}
      <div className="p-5 rounded-2xl border bg-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            credentials.isCloud
              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200'
              : 'bg-amber-500/10 text-amber-600 border border-amber-200'
          }`}>
            {credentials.isCloud ? <Cloud className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-base">
                Status da Conexão:
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                credentials.isCloud
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {credentials.isCloud ? 'Nuvem Supabase Ativa' : 'Modo Armazenamento Local'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {credentials.isCloud
                ? 'Seus dados estão sendo salvos e sincronizados com seu projeto no Supabase.'
                : 'Os dados estão armazenados localmente neste navegador. Para não perder lançamentos ao trocar de dispositivo ou limpar o cache, conecte o Supabase abaixo.'}
            </p>
          </div>
        </div>

        {credentials.isCloud && (
          <button
            onClick={handleDisconnectSupabase}
            className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Desconectar Supabase</span>
          </button>
        )}
      </div>

      {/* Messages */}
      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Configurações salvas com sucesso! A página será atualizada.</span>
        </div>
      )}

      {importStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{importStatus}</span>
        </div>
      )}

      {errorStatus && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {/* Supabase Configuration Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Credenciais do Banco de Dados Supabase
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Insira a URL do Projeto e a Chave Pública (Anon Key) do seu projeto Supabase.
            </p>
          </div>
        </div>

        {/* Step by step guide box */}
        <div className="p-5 bg-sky-50/70 border border-sky-100 rounded-2xl text-xs space-y-3">
          <span className="font-extrabold text-sky-950 text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-600" />
            Passo a Passo: Como obter a URL e a Chave no Supabase
          </span>
          <ol className="list-decimal list-inside space-y-2 text-slate-700 font-medium pl-1 leading-relaxed">
            <li>
              Acesse <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-sky-700 font-bold underline">supabase.com/dashboard</a> e faça login (via GitHub ou e-mail).
            </li>
            <li>
              Clique no seu projeto na lista de projetos.
            </li>
            <li>
              No menu lateral esquerdo, vá em <strong>Project Settings</strong> &gt; <strong>API Keys</strong> (ou <strong>API</strong>).
            </li>
            <li>
              Na seção <strong>Project URL</strong>, copie o link que começa com <code className="bg-white px-1.5 py-0.5 rounded border text-sky-800">https://xxxx.supabase.co</code> (cole no campo <strong>URL</strong> abaixo).
            </li>
            <li>
              Na seção <strong>API Keys</strong>, copie o código da <strong>Publishable key</strong> (que começa com <code className="bg-white px-1.5 py-0.5 rounded border text-sky-800">sb_publishable_...</code>) ou a chave <code className="bg-white px-1.5 py-0.5 rounded border text-sky-800">anon</code> e cole no campo <strong>Chave Pública</strong> abaixo.
            </li>
          </ol>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 mt-2">
            <span className="font-bold text-amber-900 block">⚠️ Evitando o erro "localhost se recusou a se conectar" nos e-mails:</span>
            <p className="text-amber-800/90 leading-relaxed">
              O Supabase usa por padrão <code>http://localhost:3000</code> como URL de confirmação de e-mail. Para evitar esse erro:
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-900 font-medium pl-1">
              <li><strong>Para entrar imediatamente:</strong> No Supabase, vá em <strong>Authentication &gt; Users</strong>, clique no seu usuário e selecione <strong>Confirm Email</strong>.</li>
              <li><strong>Para desativar a confirmação de e-mail obrigatória:</strong> Vá em <strong>Authentication &gt; Providers &gt; Email</strong> e desmarque a opção <em>"Confirm email"</em>.</li>
              <li><strong>Para corrigir o link de e-mail:</strong> Vá em <strong>Authentication &gt; URL Configuration</strong> e altere o <em>Site URL</em> para o link do seu app web.</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSaveSupabase} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-600" />
              URL do Projeto Supabase (VITE_SUPABASE_URL)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://seu-projeto.supabase.co"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              Chave Pública Anônima (VITE_SUPABASE_ANON_KEY)
            </label>
            <textarea
              rows={3}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-sky-500 shrink-0" />
              <span>Onde encontrar: No painel do Supabase &gt; Project Settings &gt; API.</span>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-sky-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Salvar & Conectar Supabase</span>
            </button>
          </div>
        </form>

        {/* Multi-device / Quick Connect Link Section */}
        {credentials.isCloud && (
          <div className="p-5 bg-sky-950 text-slate-100 rounded-2xl border border-sky-800 space-y-3.5 mt-4">
            <div className="flex items-center gap-2 font-black text-sky-400 text-xs sm:text-sm">
              <Smartphone className="w-4.5 h-4.5 text-sky-400 shrink-0" />
              <span>📱 Conectar seu Outro Celular Instantaneamente no Modo Nuvem:</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
              Como o outro celular abriu o aplicativo pela primeira vez, ele iniciou no modo local por segurança. Clique abaixo para enviar o link de conexão para o seu celular — ao clicar no link no celular, ele se conectará na hora à Nuvem Supabase!
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageCircle className="w-4 h-4 text-emerald-100" />
                <span>Enviar Link via WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopyQuickLink}
                className="flex-1 px-4 py-2.5 bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4 text-sky-200" />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link de Conexão'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-sky-900/80 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-start gap-1.5 font-semibold text-amber-300">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>Para forçar SEMPRE o modo Nuvem em todos os celulares permanentemente:</span>
              </div>
              <p className="text-slate-300 leading-relaxed pl-5">
                Na Vercel (ou no painel da sua hospedagem web), adicione as Variáveis de Ambiente <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Assim, qualquer pessoa ou celular que abrir o site entrará 100% automático na Nuvem!
              </p>
            </div>
          </div>
        )}

        {/* Sync Local PC Data to Supabase Button */}
        {credentials.isCloud && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="font-extrabold text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Enviar Dados do PC para a Nuvem Supabase</span>
              </span>
              <p className="text-[11px] text-emerald-800 leading-snug">
                Se você cadastrou clientes/ordens antes no computador, clique aqui para enviar tudo ao Supabase e disponibilizar no seu celular.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncToCloud}
              disabled={syncingCloud}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0 disabled:opacity-50"
            >
              {syncingCloud ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Upload className="w-4 h-4 text-emerald-100" />
              )}
              <span>{syncingCloud ? 'Enviando...' : 'Enviar Dados ao Supabase'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Backup and Restore Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Backup e Restauração de Dados (PC e Celular)
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Faça cópias de segurança do seu banco de dados diretamente para o seu computador ou celular com um único clique.
            </p>
          </div>
        </div>

        {/* Device compatibility notice */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-2">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-600" />
            <span>Como funciona o salvamento na pasta do seu dispositivo:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px]">
            <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
              <Laptop className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900">No Computador:</strong>
                O arquivo é baixado automaticamente para sua pasta <strong>Downloads</strong>.
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
              <Smartphone className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-slate-900">No Celular:</strong>
                O navegador salvará na pasta <strong>Downloads</strong> ou abrirá a tela "Salvar em Arquivos / Compartilhar".
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Export JSON */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <FileJson className="w-4 h-4 text-sky-600" />
                <span>Backup em JSON</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Recomendado para fazer cópias periódicas e guardar no PC ou celular.
              </p>
            </div>
            <button
              onClick={handleExportJson}
              disabled={exportingJson}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {exportingJson ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
              ) : (
                <Download className="w-4 h-4 text-amber-400" />
              )}
              <span>{exportingJson ? 'Gerando...' : 'Baixar Backup JSON'}</span>
            </button>
          </div>

          {/* Export SQL */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <FileCode className="w-4 h-4 text-amber-600" />
                <span>Script SQL (.sql)</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Gera instruções <code>INSERT SQL</code> prontas para rodar no Supabase Editor.
              </p>
            </div>
            <button
              onClick={handleExportSql}
              disabled={exportingSql}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
            >
              {exportingSql ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-amber-200" />
              )}
              <span>{exportingSql ? 'Gerando...' : 'Baixar Script SQL'}</span>
            </button>
          </div>

          {/* Import JSON */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between hover:border-slate-300 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Restaurar Backup</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Carregue um arquivo <code>.json</code> prévio para importar seus clientes e ordens.
              </p>
            </div>
            <label className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 text-center shadow-xs">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>Selecionar Arquivo .json</span>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Record Deletion Manager Section */}
        <RecordDeletionManager />

        {/* Danger Zone: Clear All Data */}
        <div className="pt-4 border-t border-slate-100">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500 text-white shrink-0 shadow-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-950">Zerar Banco de Dados</h4>
                <p className="text-xs text-rose-700 mt-0.5">Apaga permanentemente todos os clientes, veículos e ordens de serviço salvos.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClearAllData}
              disabled={clearing}
              className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shrink-0 disabled:opacity-50"
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{clearing ? 'Apagando...' : 'Zerar Banco de Dados'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
