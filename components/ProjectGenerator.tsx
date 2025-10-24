import React, { useState, useEffect } from 'react';
import { generateProject } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import { PackageIcon, SparklesIcon, FolderIcon, FileIcon, DownloadIcon, PlayIcon, BookOpenIcon, BriefcaseIcon, ShoppingCartIcon, XIcon } from './Icons';

declare const JSZip: any;

interface ProjectFile {
  path: string;
  content: string;
}

interface TreeNode {
  name: string;
  children?: { [key: string]: TreeNode };
  file?: ProjectFile;
}

const buildFileTree = (files: ProjectFile[]): TreeNode => {
  const root: TreeNode = { name: 'root', children: {} };
  files.forEach(file => {
    const parts = file.path.split('/');
    let currentNode = root;
    parts.forEach((part, index) => {
      if (!currentNode.children) {
        currentNode.children = {};
      }
      if (!currentNode.children[part]) {
        currentNode.children[part] = { name: part };
      }
      currentNode = currentNode.children[part];
      if (index === parts.length - 1) {
        currentNode.file = file;
      }
    });
  });
  return root;
};

const FileTree: React.FC<{ node: TreeNode; onSelectFile: (file: ProjectFile) => void; selectedFile: ProjectFile | null; level?: number }> = ({ node, onSelectFile, selectedFile, level = 0 }) => {
  if (!node.children && !node.file) return null;

  return (
    <div>
      {node.children && Object.values(node.children).sort((a,b) => {
          if (a.children && !b.children) return -1;
          if (!a.children && b.children) return 1;
          return a.name.localeCompare(b.name);
      }).map(childNode => (
        <div key={childNode.name + level} style={{ paddingLeft: `${level * 1}rem` }}>
           {childNode.children ? (
            <div className="flex items-center gap-2 py-1 text-gray-600 dark:text-slate-300">
              <FolderIcon className="w-5 h-5 flex-shrink-0" />
              <span>{childNode.name}</span>
            </div>
          ) : (
            <button 
                onClick={() => onSelectFile(childNode.file!)} 
                className={`flex items-center gap-2 py-1 w-full text-left rounded-md px-2 transition-colors duration-150 ${selectedFile?.path === childNode.file?.path ? 'bg-red-600/20 text-red-500 dark:text-red-300 border-red-500 border-l-2' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <FileIcon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{childNode.name}</span>
            </button>
          )}
          {childNode.children && <FileTree node={childNode} onSelectFile={onSelectFile} selectedFile={selectedFile} level={level + 1} />}
        </div>
      ))}
    </div>
  );
};

const templates = [
    { name: 'Portfolio', icon: BriefcaseIcon, prompt: 'A modern, responsive, single-page personal portfolio website using React, TypeScript, and Tailwind CSS. It should have sections for Home, About, Projects, and Contact. Include placeholder content for each section and a simple, clean design.' },
    { name: 'Tech Blog', icon: BookOpenIcon, prompt: 'A classic tech blog website using Next.js and Markdown for posts. It should have a main page listing all blog posts with titles and summaries, and individual pages for each post. Use a clean, readable design with a dark mode toggle.' },
    { name: 'E-commerce Storefront', icon: ShoppingCartIcon, prompt: 'A simple e-commerce storefront for a fictional sneaker store using Vue.js and Tailwind CSS. It should have a product grid page displaying multiple shoe products with images, names, and prices. Also include a basic product detail page. Use placeholder data for the products.' },
];

const aiTips = [
    "Tip: Be specific in your prompt for better results. Mention technologies and features you want.",
    "Did you know? Gemini can generate code in over a dozen popular programming languages.",
    "Tip: After generating, you can download the project and run `npm install && npm start`.",
    "Gemini can create complex configurations like Webpack or Dockerfiles.",
    "Try asking for a specific CSS framework like Bootstrap or Tailwind CSS in your prompt.",
];

const ProjectGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [fileTree, setFileTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTip, setCurrentTip] = useState(aiTips[0]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);


  useEffect(() => {
    let tipInterval: ReturnType<typeof setInterval>;
    if (isLoading) {
      tipInterval = setInterval(() => {
        setCurrentTip(aiTips[Math.floor(Math.random() * aiTips.length)]);
      }, 3000);
    }
    return () => clearInterval(tipInterval);
  }, [isLoading]);
  
  const handleGenerateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setFiles([]);
    setSelectedFile(null);
    setFileTree(null);
    setLoadingProgress(0);

    const progressInterval = setInterval(() => {
        setLoadingProgress(prev => Math.min(prev + 1, 95));
    }, 500);

    try {
      const generatedFiles = await generateProject(prompt);
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setFiles(generatedFiles);
      const tree = buildFileTree(generatedFiles);
      setFileTree(tree);
      if (generatedFiles.length > 0) {
        const firstFile = generatedFiles.find(f => f.path.toLowerCase().includes('index.html')) || generatedFiles.find(f => f.path.toLowerCase().includes('package.json')) || generatedFiles[0];
        setSelectedFile(firstFile);
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

   const handleDownloadZip = () => {
    const zip = new JSZip();
    files.forEach(file => {
      zip.file(file.path, file.content);
    });
    zip.generateAsync({ type: 'blob' }).then(content => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'gemini-project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    });
  };

  const resolvePath = (base: string, relative: string): string => {
      if (relative.startsWith('/')) {
        return relative.substring(1);
      }
      const stack = base.split('/');
      stack.pop();
      const parts = relative.split('/');
      for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
          if (stack.length > 0) stack.pop();
        } else {
          stack.push(part);
        }
      }
      return stack.join('/');
  };

 const handlePreview = () => {
    const htmlFile = files.find(f => f.path.toLowerCase().endsWith('index.html'));
    if (!htmlFile) {
        alert("No index.html file found to preview.");
        return;
    }
    
    // Open the window synchronously to avoid popup blockers
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
        alert("Could not open preview tab. Please disable your popup blocker for this site.");
        return;
    }

    const loadingHTML = `
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Project Preview</title>
        <style>
            body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #111827; color: #d1d5db; }
            .container { text-align: center; } .spinner { width: 40px; height: 40px; border: 4px solid #4b5563; border-top-color: #f87171; border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }
        </style></head><body><div class="container"><div class="spinner"></div><p style="margin-top: 1rem;">Generating project preview...</p></div></body></html>`;
    previewWindow.document.write(loadingHTML);

    const processHtml = async () => {
        let content = htmlFile.content;
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const assetRegex = /(?:href|src)\s*=\s*["']((?!https?:\/\/|data:)[^"']+)["']/g;
        const matches = Array.from(content.matchAll(assetRegex));
        
        for (const match of matches) {
            const originalPath = match[1];
            const fullPath = resolvePath(htmlFile.path, originalPath);
            const assetFile = files.find(f => f.path === fullPath);

            if (assetFile) {
                const extension = fullPath.split('.').pop()?.toLowerCase();
                const escapedPath = escapeRegex(originalPath);

                if (extension === 'css') {
                    const tagRegex = new RegExp(`<link[^>]*?href=["']${escapedPath}["'][^>]*?>`);
                    content = content.replace(tagRegex, `<style>${assetFile.content}</style>`);
                } else if (extension === 'js') {
                    const tagRegex = new RegExp(`<script[^>]*?src=["']${escapedPath}["'][^>]*?>\\s*<\\/script>`);
                    content = content.replace(tagRegex, `<script>${assetFile.content}</script>`);
                } else if (extension === 'svg') {
                    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(assetFile.content)}`;
                    content = content.replace(originalPath, dataUri);
                }
            }
        }
        
        previewWindow.document.open();
        previewWindow.document.write(content);
        previewWindow.document.close();
    };

    // Use a small timeout to allow the loading message to render before heavy processing
    setTimeout(processHtml, 100);
};

  const handleTemplateSelect = (template: {name: string, prompt: string}) => {
      setPrompt(template.prompt);
      setSelectedTemplate(template.name);
  }

  if (isLoading) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 dark:text-slate-400 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
              <LoadingSpinner className="w-12 h-12 text-red-500" />
              <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Architecting your application...</p>
              <p className="mt-2">{currentTip}</p>
              <div className="w-full max-w-md mt-6 bg-gray-200 dark:bg-gray-800 rounded-full h-4">
                  <div className="bg-red-600 h-4 rounded-full transition-all duration-500" style={{ width: `${loadingProgress}%` }}></div>
              </div>
              <p className="mt-2 text-sm text-red-500 dark:text-red-400">{loadingProgress}% Complete</p>
          </div>
      );
  }

  return (
    <div className="w-full max-w-7xl h-[calc(100vh-12rem)] lg:h-[85vh] flex flex-col items-center gap-4 p-4">
        {files.length === 0 ? (
             <div className="w-full flex flex-col items-center">
                <div className="text-center w-full">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">AI Project Generator</h2>
                    <p className="text-gray-500 dark:text-slate-400 mt-2">Start with a template or describe your web app from scratch.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 w-full max-w-4xl">
                    {templates.map(template => (
                        <button 
                          key={template.name} 
                          onClick={() => handleTemplateSelect(template)} 
                          className={`text-left p-6 bg-white dark:bg-gray-900 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all transform hover:scale-105 ${selectedTemplate === template.name ? 'border-red-500 ring-2 ring-red-500' : 'border-gray-200 dark:border-gray-800'}`}
                        >
                            <template.icon className="w-8 h-8 text-red-500" />
                            <h3 className="text-lg font-semibold mt-4 text-gray-900 dark:text-white">{template.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{template.prompt.substring(0, 80)}...</p>
                        </button>
                    ))}
                </div>
                <form onSubmit={handleGenerateProject} className="w-full max-w-4xl mt-8">
                    <div className="relative">
                        <textarea
                            value={prompt}
                            onChange={(e) => {
                                setPrompt(e.target.value);
                                if(selectedTemplate) setSelectedTemplate(null);
                            }}
                            placeholder="e.g., A simple to-do list app using React and Tailwind CSS..."
                            rows={3}
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-lg p-4 pr-12 resize-y focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                         {prompt && <button type="button" onClick={() => {setPrompt(''); setSelectedTemplate(null);}} className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 dark:hover:text-white"><XIcon className="w-5 h-5"/></button>}
                    </div>
                    <button
                        type="submit"
                        disabled={!prompt.trim()}
                        className="w-full mt-4 flex items-center justify-center gap-2 bg-red-600 text-white font-semibold px-6 py-4 rounded-lg hover:bg-red-500 disabled:bg-gray-500 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        <span>Generate Project</span>
                    </button>
                </form>
             </div>
        ) : (
          <>
            <div className="w-full flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Generated Project</h2>
                <div className="flex items-center gap-2">
                    <button onClick={handlePreview} className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-md transition-colors text-sm font-medium">
                        <PlayIcon className="w-5 h-5" /> Preview
                    </button>
                    <button onClick={handleDownloadZip} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors text-white text-sm font-medium">
                        <DownloadIcon className="w-5 h-5" /> Download (.zip)
                    </button>
                </div>
            </div>
            {error && <p className="text-red-500 dark:text-red-400 text-center w-full">{error}</p>}
            <div className="w-full flex-grow flex flex-col md:flex-row gap-4 mt-2 overflow-hidden">
                <div className="w-full md:w-1/3 lg:w-1/4 h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                  <h3 className="text-base font-semibold p-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 text-gray-900 dark:text-white">Project Files</h3>
                  <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                    {fileTree && <FileTree node={fileTree} onSelectFile={setSelectedFile} selectedFile={selectedFile} />}
                  </div>
                </div>

                <div className="w-full md:w-2/3 lg:w-3/4 h-full flex flex-col bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
                  {selectedFile ? (
                    <>
                      <div className="flex-shrink-0 flex items-center justify-between p-2 pl-4 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 rounded-t-lg">
                        <p className="font-mono text-sm text-red-600 dark:text-red-300">{selectedFile.path}</p>
                      </div>
                      <div className="flex-grow overflow-hidden relative">
                        <pre className="w-full h-full p-4 overflow-auto custom-scrollbar">
                          <code className="text-sm font-mono text-gray-800 dark:text-slate-200 whitespace-pre">{selectedFile.content}</code>
                        </pre>
                      </div>
                    </>
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-slate-500">
                        <p>Select a file to view its content</p>
                    </div>
                  )}
                </div>
            </div>
          </>
        )}
    </div>
  );
};

export default ProjectGenerator;