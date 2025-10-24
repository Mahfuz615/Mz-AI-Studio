import React, { useState, FormEvent } from 'react';
import { generateImage } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { ImageIcon, SparklesIcon } from './Icons';

const styles = ['Photorealistic', 'Cartoon', 'Anime', 'Watercolor', 'Fantasy Art', 'Cyberpunk', 'Minimalist', 'Impressionistic'];

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(styles[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateImage = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setImageUrl(null);
    setError(null);

    try {
      const url = await generateImage(prompt, style);
      setImageUrl(url);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl flex flex-col items-center gap-8 p-4 md:p-8">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">AI Image Generator</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-2">Transform your ideas into stunning visuals.</p>
      </div>

      <form onSubmit={handleGenerateImage} className="w-full flex flex-col sm:flex-row items-center gap-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A cat wearing a spacesuit on Mars"
          className="flex-grow w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          disabled={isLoading}
        />
        <div className="w-full sm:w-auto relative">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full sm:w-auto bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-4 pl-4 pr-10 appearance-none focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={isLoading}
          >
            {styles.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 text-white font-semibold px-6 py-4 rounded-lg hover:bg-red-500 disabled:bg-gray-500 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5" />
              <span>Generate</span>
            </>
          )}
        </button>
      </form>

      {error && <p className="text-red-500 dark:text-red-400 text-center mt-4">{error}</p>}
      
      <div className="w-full h-64 sm:h-80 md:h-[450px] mt-6 bg-gray-50/50 dark:bg-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl flex items-center justify-center overflow-hidden">
        {isLoading ? (
            <div className="text-center text-gray-500 dark:text-slate-400">
                <LoadingSpinner className="w-12 h-12 mx-auto" />
                <p className="mt-4">Your masterpiece is being created...</p>
            </div>
        ) : imageUrl ? (
          <img src={imageUrl} alt={prompt} className="w-full h-full object-contain" />
        ) : (
          <div className="text-center text-gray-400 dark:text-slate-500">
            <ImageIcon className="w-16 h-16 mx-auto" />
            <p className="mt-4">Your generated image will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;
