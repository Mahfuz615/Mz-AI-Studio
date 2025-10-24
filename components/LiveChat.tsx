import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveSession, LiveServerMessage, Blob } from '@google/genai';
import { BotIcon, UserIcon, MicrophoneIcon } from './Icons';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

type Transcription = {
    role: 'user' | 'model';
    text: string;
};

const LiveChat: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [conversation, setConversation] = useState<Transcription[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const currentInputRef = useRef('');
    const currentOutputRef = useRef('');

    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const conversationEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation, currentInput, currentOutput, status]);

    const stopConversation = async () => {
        setStatus('idle');
        if (sessionPromiseRef.current) {
            const session = await sessionPromiseRef.current;
            session.close();
            sessionPromiseRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }

        if(sourceNodeRef.current) {
            sourceNodeRef.current.disconnect();
            sourceNodeRef.current = null;
        }

        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            await inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            await outputAudioContextRef.current.close();
        }
        
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    };

    const startConversation = async () => {
        setError(null);
        setCurrentInput('');
        setCurrentOutput('');
        currentInputRef.current = '';
        currentOutputRef.current = '';
        setConversation([]);
        setStatus('listening');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: 'You are a friendly and helpful AI assistant. Keep your responses concise and conversational.',
                },
                callbacks: {
                    onopen: async () => {
                        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
                        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        sourceNodeRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }

                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };

                        sourceNodeRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            setStatus('speaking');
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            
                            const currentTime = outputAudioContextRef.current.currentTime;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);

                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            
                            source.addEventListener('ended', () => {
                                audioSourcesRef.current.delete(source);
                                if (audioSourcesRef.current.size === 0) {
                                    setStatus('listening');
                                }
                            });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                        }

                        if (message.serverContent?.inputTranscription) {
                            currentInputRef.current += message.serverContent.inputTranscription.text;
                            setCurrentInput(currentInputRef.current);
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputRef.current += message.serverContent.outputTranscription.text;
                            setCurrentOutput(currentOutputRef.current);
                        }
                        if(message.serverContent?.interrupted) {
                            audioSourcesRef.current.forEach(source => source.stop());
                            audioSourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                            setStatus('listening');
                        }
                        if (message.serverContent?.turnComplete) {
                            const finalInput = currentInputRef.current;
                            const finalOutput = currentOutputRef.current;
                            setConversation(prev => [
                                ...prev,
                                { role: 'user', text: finalInput },
                                { role: 'model', text: finalOutput },
                            ]);
                            currentInputRef.current = '';
                            currentOutputRef.current = '';
                            setCurrentInput('');
                            setCurrentOutput('');
                        }
                    },
                    onclose: () => {
                        console.log('Connection closed.');
                        setStatus('idle');
                    },
                    onerror: (e) => {
                        console.error('An error occurred:', e);
                        setError('An error occurred during the conversation. Please try again.');
                        stopConversation();
                    },
                }
            });

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to start the conversation.');
            setStatus('idle');
        }
    };
    
    useEffect(() => {
        return () => {
            stopConversation();
        };
    }, []);

    const handleToggleConversation = () => {
        if (status === 'idle') {
            startConversation();
        } else {
            stopConversation();
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'listening': return "Listening...";
            case 'speaking': return "Gemini is speaking...";
            case 'processing': return "Thinking...";
            default: return "Start a voice conversation with Gemini";
        }
    }

    return (
        <div className="w-full max-w-4xl h-[calc(100vh-12rem)] md:h-[80vh] flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800">
             <div className="text-center p-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Live Conversation</h2>
                <p className={`text-gray-500 dark:text-slate-400 transition-opacity duration-300 ${status === 'idle' ? 'opacity-100' : 'opacity-0'}`}>{getStatusText()}</p>
                 <div className={`flex items-center justify-center gap-2 text-red-500 dark:text-red-400 transition-opacity duration-300 h-6 ${status !== 'idle' ? 'opacity-100' : 'opacity-0'}`}>
                    {status === 'listening' && <><div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div><span>Listening...</span></>}
                    {status === 'speaking' && <><div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div><span>Gemini is speaking...</span></>}
                </div>
            </div>
            <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-4">
                    {conversation.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                             {msg.role === 'model' && <div className="w-8 h-8 flex-shrink-0 bg-red-600 rounded-full flex items-center justify-center"><BotIcon className="w-5 h-5 text-white" /></div>}
                            <div className={`max-w-xl p-4 rounded-2xl ${msg.role === 'user' ? 'bg-red-700 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-800 rounded-bl-none'}`}>
                                <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                            {msg.role === 'user' && <div className="w-8 h-8 flex-shrink-0 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center"><UserIcon className="w-5 h-5 text-gray-800 dark:text-white" /></div>}
                        </div>
                    ))}
                    {currentInput && (
                        <div className="flex items-start gap-4 justify-end">
                            <div className="max-w-xl p-4 rounded-2xl bg-red-700 text-gray-300 rounded-br-none">
                                <p className="whitespace-pre-wrap">{currentInput}</p>
                            </div>
                             <div className="w-8 h-8 flex-shrink-0 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center"><UserIcon className="w-5 h-5 text-gray-800 dark:text-white" /></div>
                        </div>
                    )}
                    {currentOutput && (
                         <div className="flex items-start gap-4">
                             <div className="w-8 h-8 flex-shrink-0 bg-red-600 rounded-full flex items-center justify-center"><BotIcon className="w-5 h-5 text-white" /></div>
                            <div className="max-w-xl p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-bl-none">
                                <p className="whitespace-pre-wrap">{currentOutput}</p>
                            </div>
                        </div>
                    )}
                </div>
                <div ref={conversationEndRef} />
            </div>
            {error && <p className="text-red-500 dark:text-red-400 text-center p-2">{error}</p>}
            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-center">
                 <button
                    onClick={handleToggleConversation}
                    className={`px-8 py-4 rounded-full text-white font-semibold flex items-center justify-center gap-3 transition-all duration-300 transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                        status !== 'idle' ? 'bg-red-600 hover:bg-red-500' : 'bg-red-600 hover:bg-red-500'
                    }`}
                >
                    <MicrophoneIcon className="w-6 h-6" />
                    <span>{status !== 'idle' ? 'Stop Conversation' : 'Start Conversation'}</span>
                </button>
            </div>
        </div>
    );
};

export default LiveChat;
