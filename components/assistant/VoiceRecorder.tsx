"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  lang: "es-US" | "en-US";
  onResult: (transcript: string) => void;
  labelIdle: string;
  labelRecording: string;
}

// Wrapper minimo sobre la Web Speech API del navegador (SpeechRecognition).
// Solo funciona en navegadores compatibles (Chrome/Edge escritorio y Android).
// Si el navegador no la soporta, se muestra un aviso y se recomienda usar texto.
export function VoiceRecorder({ lang, onResult, labelIdle, labelRecording }: Props) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      onResult(transcript);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  function toggleRecording() {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      recognitionRef.current.start();
      setRecording(true);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-fly-lightgray/70 border border-fly-gray rounded-lg p-3">
        Reconocimiento de voz no disponible en este navegador. Usa la consulta por texto.
        <br />
        Voice recognition is not available in this browser. Please use the text query instead.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleRecording}
      className={`flex flex-col items-center justify-center gap-2 w-full min-h-[8rem] rounded-2xl border-2 transition ${
        recording ? "border-risk-critical bg-risk-critical/10 animate-pulse" : "border-fly-gold bg-fly-charcoal"
      }`}
    >
      <span className="text-4xl">{recording ? "🔴" : "🎙️"}</span>
      <span className="text-sm font-semibold text-center px-4">
        {recording ? labelRecording : labelIdle}
      </span>
    </button>
  );
}

export function speakText(text: string, lang: "es-US" | "en-US") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
