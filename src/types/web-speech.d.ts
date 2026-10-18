interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: (event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void;
  onerror: () => void;
  onend: () => void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

interface Window {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
}
