import React from 'react';
import { BotIcon, ImageIcon, EditIcon, MicrophoneIcon, FileTextIcon, CodeIcon, PackageIcon } from './Icons';

type Mode = 'chat' | 'image' | 'edit' | 'live' | 'transcribe' | 'code' | 'project';

interface HeaderProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const Header: React.FC<HeaderProps> = ({ mode, setMode }) => {
  const commonButtonClasses = 'flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-950 border-b-4';
  const activeButtonClasses = 'bg-red-600 text-white shadow-md border-red-400';
  const inactiveButtonClasses = 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent';

  return (
    <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 p-4 shadow-lg border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-wider">
          Mz <span className="text-red-500">Studio</span>
        </h1>
        <nav className="flex items-center gap-x-1 md:gap-x-2 gap-y-2 flex-wrap justify-end">
          <button
            onClick={() => setMode('chat')}
            className={`${commonButtonClasses} ${mode === 'chat' ? activeButtonClasses : inactiveButtonClasses}`}
          >
            <BotIcon className="w-5 h-5" />
            <span className="hidden md:inline">Chat</span>
          </button>
           <button
            onClick={() => setMode('live')}
            className={`${commonButtonClasses} ${mode === 'live' ? activeButtonClasses : inactiveButtonClasses}`}
          >
            <MicrophoneIcon className="w-5 h-5" />
            <span className="hidden md:inline">Live Chat</span>
          </button>
           <button
            onClick={() => setMode('transcribe')}
            className={`${commonButtonClasses} ${mode === 'transcribe' ? activeButtonClasses : inactiveButtonClasses}`}
          >
            <FileTextIcon className="w-5 h-5" />
            <span className="hidden md:inline">Transcribe</span>
          </button>
          <button
            onClick={() => setMode('project')}
            className={`${commonButtonClasses} ${mode === 'project' ? activeButtonClasses : inactiveButtonClasses}`}
          >
            <PackageIcon className="w-5 h-5" />
            <span className="hidden md:inline">Project Gen</span>
          </button>
           <button
            onClick={() => setMode('code')}
            className={`${commonButtonClasses} ${mode === 'code' ? activeButtonClasses : inactiveButtonClasses}`}
          >
            <CodeIcon className="w-5 h-5" />
            <span className="hidden md:inline">Code</span>
          </button>
          <button
            onClick={() => setMode('image')}
            className={`${commonButtonClasses} ${mode === 'image' ? activeButtonClasses : inactiveButtonClasses}`}
          >
            <ImageIcon className="w-5 h-5" />
            <span className="hidden md:inline">Image Gen</span>
          </button>
          <button
            onClick={() => setMode('edit')}
            className={`${commonButtonClasses} ${mode === 'edit' ? activeButtonClasses : inactiveButtonClasses}`}
          >
            <EditIcon className="w-5 h-5" />
            <span className="hidden md:inline">Image Edit</span>
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;