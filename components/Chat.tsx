import React, { useState, useEffect, useRef, FormEvent } from 'react';
import type { Chat as GeminiChat } from '@google/genai';
import { createChatSession, createFastChatSession, generateGroundedContent, generateComplexContent, generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';
import type { ChatMessage } from '../types';
import { BotIcon, UserIcon, SendIcon, SearchIcon, LinkIcon, BrainIcon, ZapIcon, SpeakerIcon } from './Icons';
import LoadingSpinner from './LoadingSpinner';

const Chat: React.FC = () => {
  const [chat, setChat] = useState<GeminiChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [useSearch, setUseSearch] = useState(false);
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const [useFastMode, setUseFastMode] = useState(false);

  const [speakingState, setSpeakingState] = useState<{ index: number | null; isLoading: boolean }>({ index: null, isLoading: false });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    try {
      const session = useFastMode ? createFastChatSession() : createChatSession();
      setChat(session);
    } catch (e: any) {
      setError(e.message || "Failed to initialize chat session.");
    }
  }, [useFastMode]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
  const getPlaceholderText = () => {
      if (useThinkingMode) return "Ask a complex question...";
      if (useSearch) return "Ask about current events...";
      if (useFastMode) return "Ask a quick question...";
      return "Type your message...";
  }

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');

    if (useSearch) {
      try {
        const result = await generateGroundedContent(currentInput);
        const modelMessage: ChatMessage = { 
            role: 'model', 
            text: result.text, 
            sources: result.sources 
        };
        setMessages(prev => [...prev, modelMessage]);
      } catch (e: any) {
        setError(e.message || 'An error occurred while fetching the response.');
        setMessages(prev => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    } else if (useThinkingMode) {
        try {
            const resultText = await generateComplexContent(currentInput);
            const modelMessage: ChatMessage = { role: 'model', text: resultText };
            setMessages(prev => [...prev, modelMessage]);
        } catch (e: any) {
            setError(e.message || 'An error occurred while fetching the response.');
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    } else {
      if (!chat) {
        setError("Chat session not initialized.");
        setIsLoading(false);
        return;
      }
      try {
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        const stream = await chat.sendMessageStream({ message: currentInput });

        for await (const chunk of stream) {
          const chunkText = chunk.text;
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].text += chunkText;
            return newMessages;
          });
        }
      } catch (e) {
        setError('An error occurred while fetching the response. Please try again.');
        setMessages(prev => prev.slice(0, -2));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSpeak = async (text: string, index: number) => {
    if (speakingState.index !== null) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      setSpeakingState({ index: null, isLoading: false });
      if (speakingState.index === index) return;
    }
  
    setSpeakingState({ index, isLoading: true });
    setError(null);
  
    try {
      const base64Audio = await generateSpeech(text);
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioCtx = audioCtxRef.current;
      await audioCtx.resume();
  
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setSpeakingState({ index: null, isLoading: false });
        audioSourceRef.current = null;
      };
      source.start(0);
      audioSourceRef.current = source;
      setSpeakingState({ index, isLoading: false });
    } catch (e: any) {
      setError(e.message || "Failed to generate audio.");
      setSpeakingState({ index: null, isLoading: false });
    }
  };

  const toggleSearch = () => {
    setUseSearch(prev => {
      const newValue = !prev;
      if (newValue) {
        setUseThinkingMode(false);
        setUseFastMode(false);
      }
      return newValue;
    });
  };

  const toggleThinkingMode = () => {
    setUseThinkingMode(prev => {
        const newValue = !prev;
        if (newValue) {
          setUseSearch(false);
          setUseFastMode(false);
        }
        return newValue;
    });
  };

  const toggleFastMode = () => {
    setUseFastMode(prev => {
        const newValue = !prev;
        if (newValue) {
            setUseSearch(false);
            setUseThinkingMode(false);
        }
        return newValue;
    });
  };


  return (
    <div className="w-full max-w-4xl h-[calc(100vh-11rem)] md:h-[80vh] flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800">
      <div className="flex-grow p-6 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col gap-4">
          {messages.map((msg, index) => (
            <div key={index} className={`group flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'model' && (
                <div className="w-8 h-8 flex-shrink-0 bg-red-600 rounded-full flex items-center justify-center">
                  <BotIcon className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-xl p-4 rounded-2xl relative ${
                  msg.role === 'user' ? 'bg-red-700 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-800 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-2">Sources:</h4>
                      <div className="flex flex-col gap-2">
                          {msg.sources.map((source, i) => (
                              <a 
                                  key={i} 
                                  href={source.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-sm truncate flex items-center gap-2"
                                  title={source.title}
                              >
                                  <LinkIcon className="w-4 h-4 flex-shrink-0" />
                                  <span className="truncate">{source.title || source.uri}</span>
                              </a>
                          ))}
                      </div>
                  </div>
                )}
                 {msg.role === 'model' && msg.text && (
                    <button
                        onClick={() => handleSpeak(msg.text, index)}
                        disabled={speakingState.index !== null && speakingState.index !== index}
                        className="absolute -bottom-4 -right-4 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Read aloud"
                    >
                        {speakingState.isLoading && speakingState.index === index ? (
                            <LoadingSpinner className="w-4 h-4" />
                        ) : (
                            <SpeakerIcon className={`w-4 h-4 ${speakingState.index === index ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-white'}`} />
                        )}
                    </button>
                 )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 flex-shrink-0 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-gray-800 dark:text-white" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-4">
               <div className="w-8 h-8 flex-shrink-0 bg-red-600 rounded-full flex items-center justify-center">
                 <BotIcon className="w-5 h-5 text-white" />
               </div>
               <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-none p-4 flex items-center space-x-2">
                  {useSearch || useThinkingMode ? (
                    <LoadingSpinner className="w-5 h-5" />
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse"></div>
                    </>
                  )}
                  {useThinkingMode && <span className="text-sm text-gray-500 dark:text-gray-400">Thinking...</span>}
               </div>
             </div>
          )}
           <div ref={messagesEndRef} />
        </div>
      </div>
      {error && <p className="text-red-500 dark:text-red-400 text-center p-2">{error}</p>}
      <div className="p-6 border-t border-gray-200 dark:border-gray-800">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 sm:gap-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder={getPlaceholderText()}
            rows={1}
            className="flex-grow bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={toggleFastMode}
            title={useFastMode ? "Disable Fast Mode" : "Enable Fast Mode for quick responses"}
            className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                useFastMode 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <ZapIcon className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={toggleThinkingMode}
            title={useThinkingMode ? "Disable Thinking Mode" : "Enable Thinking Mode for complex queries"}
            className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                useThinkingMode 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <BrainIcon className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={toggleSearch}
            title={useSearch ? "Disable Google Search" : "Enable Google Search"}
            className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 ${
                useSearch 
                ? 'bg-red-700 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <SearchIcon className="w-6 h-6" />
          </button>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-red-600 text-white p-3 rounded-full hover:bg-red-500 disabled:bg-gray-500 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {isLoading && !useSearch && !useThinkingMode ? <LoadingSpinner /> : <SendIcon className="w-6 h-6" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;