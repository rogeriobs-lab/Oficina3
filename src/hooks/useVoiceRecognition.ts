import { useState, useEffect, useCallback, useRef } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface UseVoiceRecognitionOptions {
  onTranscript?: (transcript: string) => void;
  lang?: string;
  continuous?: boolean;
}

export function useVoiceRecognition(options?: UseVoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRec) {
      setIsSupported(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore error if already stopped
      }
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(
    (customOnTranscript?: (transcript: string) => void) => {
      setError(null);
      const SpeechRec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
      if (!SpeechRec) {
        setIsSupported(false);
        setError('Reconhecimento de voz não suportado neste navegador. Recomendamos o Google Chrome, Edge ou Safari.');
        return;
      }

      // Stop previous instance if still running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      try {
        const recognition = new SpeechRec();
        recognition.lang = options?.lang || 'pt-BR';
        recognition.continuous = options?.continuous ?? false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: any) => {
          if (!event.results || event.results.length === 0) return;
          const current = event.resultIndex;
          const spokenText = event.results[current]?.[0]?.transcript;
          if (spokenText) {
            const cleanText = spokenText.trim();
            setTranscript(cleanText);
            if (customOnTranscript) {
              customOnTranscript(cleanText);
            } else if (options?.onTranscript) {
              options.onTranscript(cleanText);
            }
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
            setError('Acesso ao microfone negado pelo navegador. Conceda permissão para ditar.');
          } else if (event.error === 'no-speech') {
            // User did not say anything, silence is normal
          } else if (event.error !== 'aborted') {
            setError(`Aviso de voz: ${event.error}`);
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        setError(err?.message || 'Não foi possível ativar o microfone');
        setIsListening(false);
      }
    },
    [options]
  );

  const toggleListening = useCallback(
    (customOnTranscript?: (transcript: string) => void) => {
      if (isListening) {
        stopListening();
      } else {
        startListening(customOnTranscript);
      }
    },
    [isListening, startListening, stopListening]
  );

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
