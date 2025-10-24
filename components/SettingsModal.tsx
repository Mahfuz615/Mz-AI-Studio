import React from 'react';
import { useSettings, ChatMode, Theme } from '../contexts/SettingsContext';
import { XIcon } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, defaultChatMode, setDefaultChatMode } = useSettings();

  if (!isOpen) return null;
  
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const handleChatModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDefaultChatMode(e.target.value as ChatMode);
  };

  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Theme Setting */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Appearance
            </label>
            <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button 
                    onClick={() => handleThemeChange('light')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${theme === 'light' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    Light
                </button>
                 <button 
                    onClick={() => handleThemeChange('dark')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'bg-black/20 dark:bg-gray-950 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}
                >
                    Dark
                </button>
            </div>
          </div>

          {/* Default Chat Mode Setting */}
          <div>
            <label htmlFor="chat-mode-select" className="block text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Default Chat Mode
            </label>
             <div className="relative">
              <select
                id="chat-mode-select"
                value={defaultChatMode}
                onChange={handleChatModeChange}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg py-3 pl-4 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="standard">Standard</option>
                <option value="fast">Fast Mode</option>
                <option value="thinking">Thinking Mode</option>
                <option value="search">Google Search</option>
              </select>
               <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 rounded-b-xl flex justify-end">
             <button 
                onClick={onClose}
                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-500 transition-colors"
            >
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
