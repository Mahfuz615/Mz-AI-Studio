import React, { useState, useEffect, useRef } from 'react';
import { generateCode, explainCode, debugCode, formatCode, generateSpeech } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';
import LoadingSpinner from './LoadingSpinner';
import { CodeIcon, SparklesIcon, SpeakerIcon, DownloadIcon, CopyIcon, CheckIcon, ExternalLinkIcon, UndoIcon, RedoIcon } from './Icons';

const languages = ['HTML', 'JavaScript', 'Python', 'TypeScript', 'CSS', 'JSON', 'Java', 'Go', 'Rust', 'SQL', 'PHP'];
type Action = 'generate' | 'explain' | 'debug' | 'format' | null;
type RightPanelTab = 'ai' | 'preview';
type SpeechState = 'idle' | 'loading' | 'speaking';

const CodeEditor: React.FC = () => {
  const [code, setCode] = useState('');
  const [debouncedCode, setDebouncedCode] = useState('');
  const [output, setOutput] = useState('');
  const [language, setLanguage] = useState(languages[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('ai');
  const [iframeContent, setIframeContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCode(code);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [code]);
  
  useEffect(() => {
      return () => {
          if (historyTimeoutRef.current) {
              clearTimeout(historyTimeoutRef.current);
          }
      }
  }, []);

  useEffect(() => {
    const containsHtmlTag = /<!DOCTYPE html|<html/i.test(debouncedCode);
    
    if (containsHtmlTag) {
        setIframeContent(debouncedCode);
    } else {
        setIframeContent(`
        <!DOCTYPE html>
        <html>
            <head>
            <meta charset="UTF-8" />
            <style>
                body { 
                    font-family: sans-serif;
                    margin: 0;
                    padding: 1rem;
                }
            </style>
            </head>
            <body>
            ${debouncedCode}
            </body>
        </html>
        `);
    }
  }, [debouncedCode]);

  useEffect(() => {
    if (language !== 'HTML') {
      setRightPanelTab('ai');
    }
  }, [language]);

  useEffect(() => {
    return () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close();
        }
    }
  }, []);

  useEffect(() => {
      if (speechState !== 'idle' && audioSourceRef.current) {
          audioSourceRef.current.stop();
          setSpeechState('idle');
      }
  }, [output]);

  const cleanResponse = (text: string) => {
    const languageRegex = new RegExp(`^\`\`\`(${language.toLowerCase()})?\n`, 'i');
    return text.replace(languageRegex, '').replace(/\n\`\`\`$/, '');
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);

    if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
    }

    historyTimeoutRef.current = setTimeout(() => {
        const newHistory = history.slice(0, historyIndex + 1);
        if (newHistory[newHistory.length - 1] !== newCode) {
            newHistory.push(newCode);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
    }, 800);
  };

  const setCodeProgrammatically = (newCode: string) => {
    setCode(newCode);
    if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
    }
    const newHistory = history.slice(0, historyIndex + 1);
     if (newHistory[newHistory.length - 1] !== newCode) {
        newHistory.push(newCode);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
        if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCode(history[newIndex]);
    }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setCode(history[newIndex]);
      }
  };

  const handleAction = async (action: Action) => {
    if (!code.trim() && action !== 'generate') {
        setError("Please enter some code to perform this action.");
        return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setActiveAction(action);
    setRightPanelTab('ai');
    setError(null);
    setOutput('');

    try {
      let result = '';
      switch (action) {
        case 'generate':
          result = await generateCode(code, language);
          const generatedCode = cleanResponse(result);
          setOutput(generatedCode);
          setCodeProgrammatically(generatedCode);
          if (language === 'HTML') {
            setRightPanelTab('preview');
          }
          break;
        case 'explain':
          result = await explainCode(code, language);
          setOutput(result);
          break;
        case 'debug':
          result = await debugCode(code, language);
          setOutput(result);
          break;
        case 'format':
          result = await formatCode(code, language);
          setCodeProgrammatically(cleanResponse(result));
          break;
        default:
          break;
      }
    } catch (e: any) {
      setError(e.message || `An error occurred while trying to ${action} code.`);
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };
  
  const handleToggleSpeech = async () => {
    if (speechState === 'speaking') {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setSpeechState('idle');
      return;
    }

    if (!output || speechState === 'loading') return;

    setSpeechState('loading');
    setError(null);

    try {
      const base64Audio = await generateSpeech(output);
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
        setSpeechState('idle');
        audioSourceRef.current = null;
      };
      source.start(0);
      audioSourceRef.current = source;
      setSpeechState('speaking');
    } catch (e: any) {
      setError(e.message || "Failed to generate audio.");
      setSpeechState('idle');
    }
  };

  const handleCopyCode = () => {
    if (!code || isCopied) return;
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadCode = () => {
    if (!code) return;
    const extensionMap: { [key: string]: string } = {
        HTML: 'html', JavaScript: 'js', Python: 'py', TypeScript: 'ts',
        CSS: 'css', JSON: 'json', Java: 'java', Go: 'go', Rust: 'rs', SQL: 'sql',
        PHP: 'php',
    };
    const extension = extensionMap[language] || 'txt';
    const filename = `gemini-code-snippet.${extension}`;

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFullScreenPreview = () => {
    const blob = new Blob([iframeContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const getInputPlaceholder = () => {
    if(language === 'HTML') return 'Describe the HTML page to generate, or type your code here to see a live preview.';
    return 'For "Generate", describe the code you want. For other actions, paste your code here.';
  }

  return (
    <div className="w-full max-w-7xl h-[calc(100vh-9rem)] lg:h-[85vh] flex flex-col items-center gap-4 p-4">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">AI Code Assistant</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-2">Generate, explain, debug, and format code with Gemini.</p>
      </div>

      <div className="w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full sm:w-auto bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg py-2 pl-4 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={isLoading}
              >
                {languages.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </select>
               <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
             <button onClick={handleCopyCode} disabled={!code.trim() || isLoading} title="Copy code" className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isCopied ? <CheckIcon className="w-5 h-5 text-green-500" /> : <CopyIcon className="w-5 h-5" />}
             </button>
             <button onClick={handleDownloadCode} disabled={!code.trim() || isLoading} title="Download code" className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <DownloadIcon className="w-5 h-5" />
             </button>
             <div className="h-6 border-l border-gray-300 dark:border-gray-700 mx-1"></div>
             <button onClick={handleUndo} disabled={historyIndex === 0 || isLoading} title="Undo" className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <UndoIcon className="w-5 h-5" />
             </button>
             <button onClick={handleRedo} disabled={historyIndex >= history.length - 1 || isLoading} title="Redo" className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <RedoIcon className="w-5 h-5" />
             </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => handleAction('explain')} disabled={isLoading} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {isLoading && activeAction === 'explain' ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4" />}Explain</button>
            <button onClick={() => handleAction('debug')} disabled={isLoading} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
               {isLoading && activeAction === 'debug' ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4" />}Debug</button>
            <button onClick={() => handleAction('format')} disabled={isLoading} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {isLoading && activeAction === 'format' ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4" />}Format</button>
            <button onClick={() => handleAction('generate')} disabled={isLoading} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white font-semibold">
              {isLoading && activeAction === 'generate' ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4" />}Generate</button>
        </div>
      </div>

      <div className="w-full flex-grow flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2 h-full flex flex-col">
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder={getInputPlaceholder()}
            className="w-full flex-grow bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none custom-scrollbar"
            disabled={isLoading}
          />
        </div>
        <div className="w-full md:w-1/2 h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
           <div className="flex-shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center">
                    <button 
                        onClick={() => setRightPanelTab('ai')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${rightPanelTab === 'ai' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        AI Output
                    </button>
                    {language === 'HTML' && (
                        <button 
                            onClick={() => setRightPanelTab('preview')}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${rightPanelTab === 'preview' ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                        >
                            Live Preview
                        </button>
                    )}
                </div>
                {language === 'HTML' && rightPanelTab === 'preview' && (
                     <button onClick={handleFullScreenPreview} title="Open in new tab" className="p-2 mr-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">
                        <ExternalLinkIcon className="w-5 h-5" />
                    </button>
                )}
           </div>
           <div className="w-full flex-grow overflow-hidden p-1">
                {rightPanelTab === 'ai' && (
                    <div className="w-full h-full font-mono text-sm overflow-y-auto custom-scrollbar p-3 relative">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-slate-400">
                                <LoadingSpinner className="w-12 h-12" />
                                <p className="mt-4">{activeAction ? `${activeAction.charAt(0).toUpperCase() + activeAction.slice(1)}ing...` : 'Loading...'}</p>
                            </div>
                        ) : output ? (
                            <>
                                <button
                                    onClick={handleToggleSpeech}
                                    disabled={speechState === 'loading'}
                                    className="absolute top-3 right-3 p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed z-10 transition-colors"
                                    title={speechState === 'speaking' ? "Stop speaking" : "Read aloud"}
                                >
                                    {speechState === 'loading' ? (
                                        <LoadingSpinner className="w-5 h-5" />
                                    ) : (
                                        <SpeakerIcon className={`w-5 h-5 ${speechState === 'speaking' ? 'text-red-500' : 'text-inherit'}`} />
                                    )}
                                </button>
                                <pre className="whitespace-pre-wrap text-gray-800 dark:text-slate-200">{output}</pre>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-slate-500">
                                <CodeIcon className="w-16 h-16" />
                                <p className="mt-4">AI output will appear here</p>
                            </div>
                        )}
                   </div>
                )}
                {rightPanelTab === 'preview' && language === 'HTML' && (
                    <iframe
                        srcDoc={iframeContent}
                        title="Live Preview"
                        sandbox="allow-scripts"
                        className="w-full h-full border-0 rounded-b-lg bg-white"
                    />
                )}
           </div>
        </div>
      </div>
        {error && <p className="text-red-500 dark:text-red-400 text-center w-full">{error}</p>}
    </div>
  );
};

export default CodeEditor;