import React from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';
import { useVoiceRecognition } from '@/src/hooks/useVoiceRecognition';

interface VoiceInputButtonProps {
  onTranscript: (spokenText: string) => void;
  value?: string;
  append?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  title?: string;
  disabled?: boolean;
  showFeedbackBadge?: boolean;
}

export default function VoiceInputButton({
  onTranscript,
  value = '',
  append = false,
  size = 'sm',
  className = '',
  title = 'Ditar por voz',
  disabled = false,
  showFeedbackBadge = true,
}: VoiceInputButtonProps) {
  const handleCapturedText = (spokenText: string) => {
    if (!spokenText) return;
    if (append && value && value.trim().length > 0) {
      onTranscript(`${value.trim()} ${spokenText}`);
    } else {
      onTranscript(spokenText);
    }
  };

  const { isListening, isSupported, error, toggleListening } = useVoiceRecognition({
    onTranscript: handleCapturedText,
    lang: 'pt-BR',
  });

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        className={`text-slate-300 opacity-60 cursor-not-allowed transition-all p-1.5 rounded-lg ${className}`}
        title="Reconhecimento de voz não suportado neste navegador (recomendamos Chrome, Edge ou Safari)"
      >
        <MicOff className={size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
    );
  }

  const sizeClasses = {
    xs: 'p-1 text-xs',
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
  }[size];

  const iconSizes = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-4.5 h-4.5',
  }[size];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => toggleListening(handleCapturedText)}
        disabled={disabled}
        title={isListening ? 'Ouvindo... Clique para parar' : title}
        className={`transition-all rounded-lg cursor-pointer flex items-center justify-center select-none ${sizeClasses} ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-md ring-2 ring-red-400/80 scale-105'
            : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
        } ${className}`}
      >
        <Mic className={`${iconSizes} ${isListening ? 'animate-bounce' : ''}`} />
      </button>

      {/* Visual Live Listening Badge */}
      {isListening && showFeedbackBadge && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-red-500/40 flex items-center gap-1.5 whitespace-nowrap animate-fade-in pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
          <span>Ouvindo... Fale agora</span>
        </div>
      )}

      {/* Temporary Error Feedback */}
      {error && !isListening && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-red-800 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-lg flex items-center gap-1 whitespace-nowrap animate-fade-in pointer-events-none max-w-[220px]">
          <AlertCircle className="w-3 h-3 text-red-300 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
    </div>
  );
}
