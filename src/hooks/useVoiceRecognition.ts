import { useState, useCallback, useRef } from 'react';
import { groq } from '../lib/groq';

/**
 * Voice Recognition using Groq Whisper API via MediaRecorder.
 *
 * Why Groq Whisper instead of Web Speech API:
 * - Web Speech API is unreliable on iOS Safari (stops randomly, fr-FR fails)
 * - Whisper handles French + Vietnamese code-switching naturally
 * - Works consistently across all browsers including iOS Safari 15+
 * - Push-to-talk UX: record while holding, transcribe on release
 */

// Supported MIME types — pick best available on the device
function getBestMimeType(): string {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
    '',
  ];
  for (const type of candidates) {
    if (!type || MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useVoiceRecognition(onResult: (text: string) => void, language?: string, prompt?: string) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const autoReleaseTimerRef = useRef<number>(0);

  /** Request mic permission and start recording */
  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mimeType = getBestMimeType();
      const recorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Stop all tracks to release mic indicator on phone
        stream.getTracks().forEach((t) => t.stop());

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setIsProcessing(false);
          return;
        }

        const mime = chunks[0].type || mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: mime });

        // Skip tiny blobs (user tapped too briefly)
        if (audioBlob.size < 1000) {
          setIsProcessing(false);
          return;
        }

        // Determine file extension from MIME
        const ext = mime.includes('mp4') ? 'mp4'
          : mime.includes('ogg') ? 'ogg'
          : mime.includes('mpeg') ? 'mp3'
          : 'webm';

        const audioFile = new File([audioBlob], `voice.${ext}`, { type: mime });

        try {
          setInterimTranscript('⏳ Đang nhận dạng...');
          const transcription = await groq.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-large-v3-turbo',
            ...(language ? { language } : {}),
            ...(prompt ? { prompt } : {}),
            response_format: 'json',
            temperature: 0.0,
          });

          const text = transcription.text?.trim();
          if (text && text.length > 0) {
            onResultRef.current(text);
          }
        } catch (err) {
          console.error('Whisper transcription error:', err);
        } finally {
          setIsProcessing(false);
          setInterimTranscript('');
        }
      };

      // Do not use timeslice (100) as it is notoriously buggy on iOS Safari
      recorder.start();
      setIsRecording(true);

      // Auto-release mic after 60s to prevent audio ducking on mobile
      clearTimeout(autoReleaseTimerRef.current);
      autoReleaseTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          console.log('[Voice] Auto-releasing mic after 60s');
          try { mediaRecorderRef.current.stop(); } catch (e) {}
          setIsRecording(false);
          setIsProcessing(true);
        }
      }, 60000);
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        alert('Vui lòng cho phép truy cập Microphone để dùng tính năng ghi âm.');
      } else {
        console.error('MediaRecorder error:', err);
      }
      setIsRecording(false);
    }
  }, [isRecording, isProcessing]);

  /** Stop recording and trigger Whisper transcription */
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;
    clearTimeout(autoReleaseTimerRef.current);
    setIsRecording(false);
    setIsProcessing(true);
    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
    }
  }, [isRecording]);

  /** Toggle: tap once to start, tap again to stop & transcribe */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isProcessing,
    interimTranscript,
    toggleRecording,
    stopRecording,
  };
}
