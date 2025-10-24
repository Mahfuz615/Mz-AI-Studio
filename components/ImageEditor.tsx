import React, { useState, FormEvent } from 'react';
import { editImage } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { ImageIcon, SparklesIcon, EditIcon } from './Icons';

interface ImageFile {
  data: string;
  mimeType: string;
  url: string;
}

const ImageEditor: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [originalImage, setOriginalImage] = useState<ImageFile | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const [header, data] = result.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1];
        if (data && mimeType) {
          setOriginalImage({ data, mimeType, url: result });
          setEditedImageUrl(null);
          setError(null);
        } else {
          setError("Could not read the selected file. Please try a different image.");
        }
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImage = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !originalImage || isLoading) return;

    setIsLoading(true);
    setEditedImageUrl(null);
    setError(null);

    try {
      const url = await editImage(originalImage.data, originalImage.mimeType, prompt);
      setEditedImageUrl(url);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred while editing the image.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl flex flex-col items-center gap-8 p-4 md:p-8">
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">AI Image Editor</h2>
        <p className="text-gray-500 dark:text-slate-400 mt-2">Use text prompts to magically edit your images.</p>
      </div>

      <div className="w-full flex flex-col md:flex-row gap-6">
        {/* Left Side: Upload and Original Image */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
            <label htmlFor="image-upload" className="w-full h-64 sm:h-80 md:h-[450px] bg-gray-50/50 dark:bg-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer hover:border-red-500 transition-colors">
                 {originalImage ? (
                    <img src={originalImage.url} alt="Original" className="w-full h-full object-contain" />
                 ) : (
                    <div className="text-center text-gray-400 dark:text-slate-500 p-4">
                        <ImageIcon className="w-16 h-16 mx-auto" />
                        <p className="mt-4 font-semibold">Click to upload an image</p>
                        <p className="text-sm">PNG, JPG, WEBP, etc.</p>
                    </div>
                )}
            </label>
            <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Right Side: Prompt and Edited Image */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
            <div className="w-full h-64 sm:h-80 md:h-[450px] bg-gray-50/50 dark:bg-gray-900/50 border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-xl flex items-center justify-center overflow-hidden">
                {isLoading ? (
                    <div className="text-center text-gray-500 dark:text-slate-400">
                        <LoadingSpinner className="w-12 h-12 mx-auto" />
                        <p className="mt-4">Applying edits...</p>
                    </div>
                ) : editedImageUrl ? (
                    <img src={editedImageUrl} alt="Edited" className="w-full h-full object-contain" />
                ) : (
                    <div className="text-center text-gray-400 dark:text-slate-500 p-4">
                        <EditIcon className="w-16 h-16 mx-auto" />
                        <p className="mt-4">Your edited image will appear here</p>
                    </div>
                )}
            </div>
        </div>
      </div>

       <form onSubmit={handleEditImage} className="w-full flex flex-col sm:flex-row items-center gap-4 mt-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Add a retro filter, make it a painting"
          className="flex-grow w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          disabled={isLoading || !originalImage}
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim() || !originalImage}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 text-white font-semibold px-6 py-4 rounded-lg hover:bg-red-500 disabled:bg-gray-500 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              <span>Editing...</span>
            </>
          ) : (
            <>
              <SparklesIcon className="w-5 h-5" />
              <span>Apply Edit</span>
            </>
          )}
        </button>
      </form>

      {error && <p className="text-red-500 dark:text-red-400 text-center mt-4">{error}</p>}
    </div>
  );
};

export default ImageEditor;
