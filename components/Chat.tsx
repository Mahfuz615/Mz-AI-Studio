import React, { useState, useEffect, useRef, FormEvent } from 'react';
import type { Chat as GeminiChat } from '@google/genai';
import { createChatSession, createFastChatSession, generateGroundedContent, generateComplexContent, generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';
import type { ChatMessage, Conversation } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { BotIcon, UserIcon, SendIcon, SearchIcon, LinkIcon, BrainIcon, ZapIcon, SpeakerIcon } from './Icons';
import LoadingSpinner from './LoadingSpinner';
import ConversationHistory from './ConversationHistory';

const Chat: React.FC = () => {
  const { defaultChatMode } = useSettings();

  const [chat, setChat] = useState<GeminiChat | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [useSearch, setUseSearch] = useState(defaultChatMode === 'search');
  const [useThinkingMode, setUseThinkingMode] = useState(defaultChatMode === 'thinking');
  const [useFastMode, setUseFastMode] = useState(defaultChatMode === 'fast');

  const [speakingState, setSpeakingState] = useState<{ index: number | null; isLoading: boolean }>({ index: null, isLoading: false });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Load conversations from local storage on mount
  useEffect(() => {
    try {
        const saved = localStorage.getItem('gemini-studio-conversations');
        if (saved) {
            setConversations(JSON.parse(saved));
        }
    } catch (e) {
        console.error("Failed to load conversations:", e);
    }
  }, []);

  // Save conversations to local storage whenever they change
  useEffect(() => {
    try {
        localStorage.setItem('gemini-studio-conversations', JSON.stringify(conversations));
    } catch (e) {
        console.error("Failed to save conversations:", e);
    }
  }, [conversations]);

  // Effect to initialize or re-initialize chat session based on active conversation
  useEffect(() => {
    try {
      const activeConv = conversations.find(c => c.id === activeConversationId);
      const history = activeConv?.messages.slice(1).map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
      })) || [];

      const session = useFastMode ? createFastChatSession(history) : createChatSession(history);
      setChat(session);
    } catch (e: any) {
      setError(e.message || "Failed to initialize chat session.");
    }
  }, [activeConversationId, useFastMode, conversations]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeConversationId, isLoading]);

  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const messages = activeConversation?.messages || [{ role: 'model', text: 'Hello! How can I help you today?' }];
  
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
    const currentInput = input;
    setInput('');

    let conversationId = activeConversationId;
    let isNewConversation = false;

    if (!conversationId) {
        isNewConversation = true;
        conversationId = Date.now().toString();
        const newConversation: Conversation = {
            id: conversationId,
            title: currentInput.length > 40 ? currentInput.substring(0, 37) + '...' : currentInput,
            messages: [messages[0], userMessage],
            timestamp: Date.now()
        };
        setConversations(prev => [...prev, newConversation]);
        setActiveConversationId(conversationId);
    } else {
        setConversations(prev => prev.map(c => 
            c.id === conversationId ? { ...c, messages: [...c.messages, userMessage], timestamp: Date.now() } : c
        ));
    }

    const handleError = (err: any) => {
        setError(err.message || 'An error occurred. Please try again.');
        // Revert optimistic UI update
        if (isNewConversation) {
            setConversations(prev => prev.filter(c => c.id !== conversationId));
            setActiveConversationId(null);
        } else {
            setConversations(prev => prev.map(c => 
                c.id === conversationId ? { ...c, messages: c.messages.slice(0, -1) } : c
            ));
        }
    };
    
    const appendMessage = (message: ChatMessage) => {
        setConversations(prev => prev.map(c => 
            c.id === conversationId ? { ...c, messages: [...c.messages, message] } : c
        ));
    };

    if (useSearch) {
      try {
        const result = await generateGroundedContent(currentInput);
        appendMessage({ role: 'model', text: result.text, sources: result.sources });
      } catch (e: any) { handleError(e); } finally { setIsLoading(false); }
    } else if (useThinkingMode) {
        try {
            const resultText = await generateComplexContent(currentInput);
            appendMessage({ role: 'model', text: resultText });
        } catch (e: any) { handleError(e); } finally { setIsLoading(false); }
    } else {
      if (!chat) {
        setError("Chat session not initialized.");
        setIsLoading(false);
        return;
      }
      try {
        appendMessage({ role: 'model', text: '' }); // Placeholder for streaming
        const stream = await chat.sendMessageStream({ message: currentInput });

        for await (const chunk of stream) {
          const chunkText = chunk.text;
          setConversations(prev => prev.map(c => {
              if (c.id === conversationId) {
                  const newMessages = [...c.messages];
                  newMessages[newMessages.length - 1].text += chunkText;
                  return { ...c, messages: newMessages, timestamp: Date.now() };
              }
              return c;
          }));
        }
      } catch (e) {
        handleError(e);
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
  
  const handleNewConversation = () => {
    setActiveConversationId(null);
    setUseSearch(defaultChatMode === 'search');
    setUseThinkingMode(defaultChatMode === 'thinking');
    setUseFastMode(defaultChatMode === 'fast');
  };

  const handleSelectConversation = (id: string) => setActiveConversationId(id);
  const handleDeleteConversation = (id: string) => {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
          setActiveConversationId(null);
      }
  };

  const toggleSearch = () => setUseSearch(p => { if(!p){setUseThinkingMode(false);setUseFastMode(false);} return !p; });
  const toggleThinkingMode = () => setUseThinkingMode(p => { if(!p){setUseSearch(false);setUseFastMode(false);} return !p; });
  const toggleFastMode = () => setUseFastMode(p => { if(!p){setUseSearch(false);setUseThinkingMode(false);} return !p; });

  return (
    <div className="w-full max-w-7xl h-[calc(100vh-11rem)] md:h-[85vh] flex gap-4">
      <ConversationHistory
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      <div className="flex-grow h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800">
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
            <button type="button" onClick={toggleFastMode} title={useFastMode ? "Disable Fast Mode" : "Enable Fast Mode"}
              className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  useFastMode ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
              <ZapIcon className="w-6 h-6" />
            </button>
            <button type="button" onClick={toggleThinkingMode} title={useThinkingMode ? "Disable Thinking Mode" : "Enable Thinking Mode"}
              className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  useThinkingMode ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
              <BrainIcon className="w-6 h-6" />
            </button>
            <button type="button" onClick={toggleSearch} title={useSearch ? "Disable Google Search" : "Enable Google Search"}
              className={`p-3 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  useSearch ? 'bg-red-700 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}>
              <SearchIcon className="w-6 h-6" />
            </button>
            <button type="submit" disabled={isLoading || !input.trim()} className="bg-red-600 text-white p-3 rounded-full hover:bg-red-500 disabled:bg-gray-500 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors duration-200">
              {isLoading && !useSearch && !useThinkingMode ? <LoadingSpinner /> : <SendIcon className="w-6 h-6" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;