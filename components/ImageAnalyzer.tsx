import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { renderMarkdown } from '../src/utils/markdownRenderer';

// Helper function to convert a File to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove "data:mime/type;base64," prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

interface AnalyzerState {
  imageFile: File | null;
  imagePreviewUrl: string | null;
  prompt: string;
  analysisResult: string;
  error: string;
  isLoading: boolean;
}

const ImageAnalyzer: React.FC = () => {
  const [state, setState] = useState<AnalyzerState>({
    imageFile: null,
    imagePreviewUrl: null,
    prompt: '',
    analysisResult: '',
    error: '',
    isLoading: false,
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke the old object URL to avoid memory leaks
      if (state.imagePreviewUrl) {
        URL.revokeObjectURL(state.imagePreviewUrl);
      }
      const previewUrl = URL.createObjectURL(file);
      setState({
        ...state,
        imageFile: file,
        imagePreviewUrl: previewUrl,
        analysisResult: '',
        error: ''
      });
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, prompt: e.target.value });
  };

  const handleAnalyzeClick = async () => {
    if (!state.imageFile || !state.prompt.trim()) {
      setState(prevState => ({
        ...prevState,
        error: "Please upload an image and enter a prompt.",
      }));
      return;
    }

    setState(prevState => ({ ...prevState, isLoading: true, analysisResult: '', error: '' }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Image = await fileToBase64(state.imageFile);

      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: state.imageFile.type,
        },
      };

      const textPart = {
        text: state.prompt,
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
      });

      setState(prevState => ({
        ...prevState,
        analysisResult: response.text,
        isLoading: false
      }));

    } catch (error) {
      console.error("Error during image analysis:", error);
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        error: "An error occurred during analysis. Please try another image or prompt.",
      }));
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleAnalyzeClick();
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-4xl mx-auto border border-slate-200">
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">
        Image Analyzer
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4 items-start">
        <div className={state.imagePreviewUrl ? 'md:col-span-1' : 'md:col-span-2'}>
          <label htmlFor="image-upload-input" className="block text-sm font-medium text-slate-700 mb-2">Upload Image</label>
          <div className="mt-1 flex justify-center py-12 px-6 border-2 border-slate-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <svg className="mx-auto h-16 w-16 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex text-lg text-slate-600 justify-center">
                <label htmlFor="image-upload-input" className="relative cursor-pointer bg-white rounded-md font-medium text-amber-600 hover:text-amber-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-amber-500">
                  <span>Upload a file</span>
                  <input id="image-upload-input" name="image-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
              <p className="text-sm text-slate-500">PNG, JPG, WEBP, etc.</p>
            </div>
          </div>
        </div>

        {state.imagePreviewUrl && (
          <div className="flex flex-col items-center justify-center">
             <label className="block text-sm font-medium text-slate-700 mb-2">Image Preview</label>
            <img src={state.imagePreviewUrl} alt="Preview" className="max-h-64 w-auto rounded-lg object-contain border border-slate-200 bg-slate-50" />
          </div>
        )}
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row items-center gap-3 mb-2">
        <input
          type="text"
          value={state.prompt}
          onChange={handlePromptChange}
          placeholder="What do you want to know about this image?"
          className="flex-grow w-full px-4 py-3 text-base text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition placeholder-slate-400"
          aria-label="Image analysis prompt"
        />
        <button
          type="submit"
          className="w-full sm:w-auto px-8 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition duration-200 ease-in-out disabled:bg-slate-300 disabled:cursor-not-allowed"
          disabled={!state.imageFile || !state.prompt.trim() || state.isLoading}
        >
          {state.isLoading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {state.error && <p className="text-red-600 text-sm mb-4 px-1">{state.error}</p>}

      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 min-h-[200px] mt-6">
        <h3 className="text-lg font-medium text-slate-700 mb-4">Analysis Result</h3>
        {state.isLoading ? (
           <div className="text-slate-500 text-center flex flex-col items-center justify-center h-full pt-8">
             <svg className="animate-spin h-6 w-6 text-amber-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
             <p>Analyzing image...</p>
           </div>
        ) : state.analysisResult ? (
          <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(state.analysisResult)} />
        ) : (
          <div className="text-slate-500 text-center flex items-center justify-center h-full pt-8">
            <p>Upload an image and enter a prompt to generate an analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageAnalyzer;