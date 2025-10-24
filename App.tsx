import React, { useState } from 'react';
import Header from './components/Header';
import Chat from './components/Chat';
import ImageGenerator from './components/ImageGenerator';
import ImageEditor from './components/ImageEditor';
import LiveChat from './components/LiveChat';
import AudioTranscriber from './components/AudioTranscriber';
import CodeEditor from './components/CodeEditor';
import ProjectGenerator from './components/ProjectGenerator';
import SettingsModal from './components/SettingsModal';

type Mode = 'chat' | 'image' | 'edit' | 'live' | 'transcribe' | 'code' | 'project';

const App: React.FC = () => {
  const [mode, setMode] = useState<Mode>('project');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="bg-gray-100 dark:bg-gray-950 min-h-screen text-gray-800 dark:text-gray-200 font-sans flex flex-col transition-colors duration-300">
      <Header 
        mode={mode} 
        setMode={setMode} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
      />
      <main className="flex-grow flex flex-col items-center justify-center p-2 sm:p-4">
        {mode === 'chat' && <Chat />}
        {mode === 'image' && <ImageGenerator />}
        {mode === 'edit' && <ImageEditor />}
        {mode === 'live' && <LiveChat />}
        {mode === 'transcribe' && <AudioTranscriber />}
        {mode === 'code' && <CodeEditor />}
        {mode === 'project' && <ProjectGenerator />}
      </main>
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default App;