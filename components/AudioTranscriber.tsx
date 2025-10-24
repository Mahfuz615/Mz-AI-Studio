import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { MicrophoneIcon, FileTextIcon, CopyIcon } from './Icons';
import LoadingSpinner from './LoadingSpinner';

const AudioTranscriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleStartRecording = async () => {
    setTranscription('');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsLoading(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64String = (reader.result as string).split(',')[1];
            const result = await transcribeAudio(base64String, audioBlob.type);
            setTranscription(result);
          } catch (e: any) {
            setError(e.message || 'Failed to transcribe audio.');
          } finally {
            setIsLoading(false);
            stream.getTracks().forEach(track => track.stop());
          }
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcription);
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-8 p-4 md:p-8">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Audio Transcription</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-2">Record audio from your microphone to get a text transcription.</p>
      </div>

      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            disabled={isLoading}
            className="px-8 py-4 rounded-full text-white font-semibold flex items-center justify-center gap-3 transition-all duration-300 transform bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 disabled:bg-gray-500 dark:disabled:bg-gray-700"
          >
            <MicrophoneIcon className="w-6 h-6" />
            <span>Start Recording</span>
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="px-8 py-4 rounded-full text-white font-semibold flex items-center justify-center gap-3 transition-all duration-300 transform bg-red-600 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
          >
            <div className="w-6 h-6 flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-sm"></div>
            </div>
            <span>Stop Recording</span>
          </button>
        )}
      </div>
      
      {isRecording && (
        <div className="flex items-center gap-2 text-red-500 dark:text-red-400">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>Recording...</span>
        </div>
      )}

      {error && <p className="text-red-500 dark:text-red-400 text-center mt-4">{error}</p>}

      <div className="w-full h-64 sm:h-80 md:h-[450px] mt-6 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl flex items-center justify-center overflow-hidden p-4">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-slate-400">
            <LoadingSpinner className="w-12 h-12 mx-auto" />
            <p className="mt-4">Transcribing your audio...</p>
          </div>
        ) : transcription ? (
          <div className="w-full h-full relative">
            <textarea
                readOnly
                value={transcription}
                className="w-full h-full bg-transparent text-gray-800 dark:text-slate-200 resize-none p-4 custom-scrollbar focus:outline-none"
            />
            <button onClick={handleCopy} className="absolute top-4 right-4 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 p-2 rounded-md text-gray-700 dark:text-slate-300 transition-colors" title="Copy to clipboard">
                <CopyIcon className="w-5 h-5"/>
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-400 dark:text-slate-500">
            <FileTextIcon className="w-16 h-16 mx-auto" />
            <p className="mt-4">Your transcription will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioTranscriber;
