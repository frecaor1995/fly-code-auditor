"use client";

import { useEffect, useRef, useState } from "react";
import { t as translate } from "@/lib/i18n/dictionary";

interface Props {
  lang: "es-US" | "en-US";
  uiLang: "es" | "en";
  onResult: (transcript: string) => void;
  onUseTextFallback?: () => void;
  labelIdle: string;
  labelRecording: string;
}

// Wrapper minimo sobre la Web Speech API del navegador (SpeechRecognition).
// Solo funciona en navegadores compatibles (Chrome/Edge escritorio y Android).
// iOS Safari no la implementa: en ese caso (y ante cualquier error del
// microfono) se muestra un aviso claro y se ofrece continuar por texto.
export function VoiceRecorder({ lang, uiLang, onResult, onUseTextFallback, labelIdle, labelRecording }: Props) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState(false);
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
    recognition.onerror = () => {
      setRecording(false);
      setMicError(true);
    };
    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = lang;
    }
  }, [lang]);

  function toggleRecording() {
    if (!recognitionRef.current) return;
    setMicError(false);
    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setRecording(true);
      } catch {
        setMicError(true);
      }
    }
  }

  if (!supported || micError) {
    return (
      <div className="space-y-3 border border-fly-gray rounded-lg p-3">
        <p className="text-sm text-fly-lightgray/70">
          {translate(uiLang, supported ? "voice_micError" : "voice_unavailable")}
        </p>
        {onUseTextFallback && (
          <button
            type="button"
            onClick={onUseTextFallback}
            className="w-full min-h-[3rem] rounded-xl bg-fly-gold text-fly-black font-semibold"
          >
            {translate(uiLang, "voice_useText")}
          </button>
        )}
      </div>
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
