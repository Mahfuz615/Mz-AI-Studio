import React from 'react';
import type { Conversation } from '../types';
import { PlusIcon, TrashIcon, MessageSquareIcon } from './Icons';

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({ 
    conversations, 
    activeConversationId, 
    onSelectConversation, 
    onNewConversation,
    onDeleteConversation
}) => {

  const sortedConversations = [...conversations].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="w-full md:w-1/4 lg:w-1/5 h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <button
                onClick={onNewConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900 bg-red-600 text-white hover:bg-red-500 font-semibold"
            >
                <PlusIcon className="w-5 h-5" />
                New Chat
            </button>
        </div>
        <div className="flex-grow p-2 overflow-y-auto custom-scrollbar">
            <nav className="flex flex-col gap-1">
                {sortedConversations.map(conv => (
                    <div key={conv.id} className="group relative">
                        <button
                            onClick={() => onSelectConversation(conv.id)}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 text-sm ${
                                activeConversationId === conv.id
                                ? 'bg-red-600/10 dark:bg-red-500/10 text-red-600 dark:text-red-300'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                        >
                            <MessageSquareIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate flex-grow">{conv.title}</span>
                        </button>
                         <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteConversation(conv.id);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            title="Delete conversation"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </nav>
        </div>
    </div>
  );
};

export default ConversationHistory;
