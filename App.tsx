import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Chat from './components/Chat';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import LiveChat from './components/LiveChat';
import AudioTranscriber from './components/AudioTranscriber';
import CodeEditor from './components/CodeEditor';
import ProjectGenerator from './components/ProjectGenerator';

type Mode = 'chat' | 'image' | 'edit' | 'live' | 'transcribe' | 'code' | 'project';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('project');
  
  useEffect(() => {
    // Set the dark theme permanently on the root element
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="bg-gray-950 min-h-screen text-gray-200 font-sans flex flex-col">
      <Header mode={mode} setMode={setMode} />
      <main className="flex-grow flex flex-col items-center justify-center p-2 sm:p-4">
        {mode === 'chat' && <Chat />}
        {mode === 'image' && <ImageGenerator />}
        {mode === 'edit' && <ImageEditor />}
        {mode === 'live' && <LiveChat />}
        {mode === 'transcribe' && <AudioTranscriber />}
        {mode === 'code' && <CodeEditor />}
        {mode === 'project' && <ProjectGenerator />}
      </main>
    </div>
  );
};

export default App;