
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { GeneralProfileResult, ProfilerData, Deal } from '../App';
import { getProfilerPrompt } from '../utils/prompts';
import { SourcingResult } from './SourcingEngine';
import { renderMarkdown } from '../utils/markdownRenderer';

interface CompanyProfilerProps {
    setGeneralProfile: React.Dispatch<React.SetStateAction<GeneralProfileResult | null>>;
    profilerData: ProfilerData;
    setProfilerData: React.Dispatch<React.SetStateAction<ProfilerData>>;
    onClear: () => void;
    isProfilingGlobal: boolean;
    setIsProfilingGlobal: React.Dispatch<React.SetStateAction<boolean>>;
    profilingProgressMessage: string;
    setProfilingProgressMessage: React.Dispatch<React.SetStateAction<string>>;
    deals: Deal[];
    onAddToPipeline: (sourcingResult: SourcingResult) => void;
}

interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

// Updated, more granular analysis aspects
interface AnalysisAspects {
  [key: string]: boolean;
  businessModel: boolean;
  productsServices: boolean;
  targetMarketCustomerBase: boolean;
  managementTeamOrg: boolean;
  operationsScalability: boolean;
  technologyIp: boolean;
  marketPosition: boolean;
  competitiveLandscape: boolean;
  financialHealth: boolean;
  supplyChainPartners: boolean;
  regulatoryCompliance: boolean;
  growthOpportunities: boolean;
}

type AnalysisType = 'General Summary' | 'SWOT Analysis' | 'Investment Thesis';

interface ProfilerState {
  profilerMode: 'single' | 'compare' | 'document';
  urlInputTwo: string;
  error: string;
  isStreaming: boolean;
  analysisAspects: AnalysisAspects;
  analysisType: AnalysisType;
  chatSession: Chat | null;
  followUpInput: string;
  copied: boolean;
  saved: boolean;
  isCorrecting: boolean;
  correctionInput: string;
  uploadedFile: File | null;
  specificAsk: string;
  companyNameInput: string;
}

const isValidUrl = (urlString: string): boolean => {
  if (!urlString.trim()) return false;
  if (!/^https?:\/\//i.test(urlString)) {
      return false;
  }
  try {
    new URL(urlString);
    return true;
  } catch (e) {
    return false;
  }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = (error) => reject(error);
    });
  };

const aspectOptions: { key: keyof AnalysisAspects; label: string }[] = [
    { key: 'businessModel', label: 'Business Model' },
    { key: 'productsServices', label: 'Products/Services' },
    { key: 'targetMarketCustomerBase', label: 'Target Market & Customers' },
    { key: 'managementTeamOrg', label: 'Management Team & Org' },
    { key: 'operationsScalability', label: 'Operations & Scalability' },
    { key: 'technologyIp', label: 'Technology & IP' },
    { key: 'marketPosition', label: 'Market Position' },
    { key: 'competitiveLandscape', label: 'Competitive Landscape' },
    { key: 'financialHealth', label: 'Financial Health' },
    { key: 'supplyChainPartners', label: 'Supply Chain / Partners' },
    { key: 'regulatoryCompliance', label: 'Regulatory/Compliance' },
    { key: 'growthOpportunities', label: 'Growth Opportunities' },
];

const CompanyProfiler: React.FC<CompanyProfilerProps> = ({ setGeneralProfile, profilerData, setProfilerData, onClear, isProfilingGlobal, setIsProfilingGlobal, profilingProgressMessage, setProfilingProgressMessage, deals, onAddToPipeline }) => {
  const [state, setState] = useState<ProfilerState>({
    profilerMode: 'single',
    urlInputTwo: '',
    error: '',
    isStreaming: false,
    analysisAspects: {
        businessModel: false,
        productsServices: false,
        targetMarketCustomerBase: false,
        managementTeamOrg: false,
        operationsScalability: false,
        technologyIp: false,
        marketPosition: false,
        competitiveLandscape: false,
        financialHealth: false,
        supplyChainPartners: false,
        regulatoryCompliance: false,
        growthOpportunities: false,
    },
    analysisType: 'General Summary',
    chatSession: null,
    followUpInput: '',
    copied: false,
    saved: false,
    isCorrecting: false,
    correctionInput: '',
    uploadedFile: null,
    specificAsk: '',
    companyNameInput: '',
  });

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const isAnalyzed = profilerData.analysisResult.profile || profilerData.analysisResult.insights;

  // --- Logic for Select/Deselect All Checkbox ---
  const allAspectKeys = Object.keys(state.analysisAspects) as Array<keyof AnalysisAspects>;
  const checkedAspects = allAspectKeys.filter(key => state.analysisAspects[key]);
  const allChecked = checkedAspects.length === allAspectKeys.length;
  const someChecked = checkedAspects.length > 0 && !allChecked;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
        selectAllCheckboxRef.current.checked = allChecked;
        selectAllCheckboxRef.current.indeterminate = someChecked;
    }
  }, [allChecked, someChecked]);

  const handleSelectAllChange = () => {
    const shouldSelectAll = !allChecked;
    setState(prevState => {
        const newAspects = { ...prevState.analysisAspects };
        for (const key in newAspects) {
            newAspects[key as keyof AnalysisAspects] = shouldSelectAll;
        }
        return { ...prevState, analysisAspects: newAspects };
    });
  };

  const examplePrompts = [
    "Summarize the key risks in 3 bullet points.",
    "Who are their main competitors and how do they differ?",
    "What's their primary revenue model?",
    "What would be a key integration challenge?",
  ];

  const handleModeChange = (mode: 'single' | 'compare' | 'document') => {
    onClear();
    setState(prevState => ({
      ...prevState,
      profilerMode: mode,
      urlInputTwo: '',
      error: '',
      chatSession: null,
      uploadedFile: null,
      companyNameInput: '',
    }));
  };
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfilerData(prev => ({ ...prev, urlInput: e.target.value, sources: null }));
    setState({ ...state, error: '' });
  };
  
  const handleUrlTwoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, urlInputTwo: e.target.value, error: '', });
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        setState(prevState => ({ ...prevState, uploadedFile: file, error: '' }));
      } else {
        setState(prevState => ({ ...prevState, error: 'Please upload a PDF or PPTX file.', uploadedFile: null }));
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files);
  };

  const handleAspectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setState(prevState => ({
      ...prevState,
      analysisAspects: {
        ...prevState.analysisAspects,
        [name]: checked,
      },
    }));
  };

  const handleAnalyzeClick = async () => {
    if (!isValidUrl(profilerData.urlInput)) {
      setState(prevState => ({ ...prevState, error: 'Please enter a valid URL starting with http:// or https://.' }));
      return;
    }

    const selectedAspectKeys = Object.entries(state.analysisAspects)
      .filter(([, isSelected]) => isSelected)
      .map(([key]) => key);

    if (selectedAspectKeys.length === 0 && state.analysisType === 'General Summary') {
      setState(prevState => ({ ...prevState, error: 'Please select at least one analysis aspect.' }));
      return;
    }
    
    onClear();

    setIsProfilingGlobal(true);
    setProfilingProgressMessage('Analyzing...');
    setState(prevState => ({ 
        ...prevState, 
        isStreaming: true,
        error: '', 
        chatSession: null,
        isCorrecting: false,
    }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({
          model: 'gemini-2.5-pro',
          config: {
            tools: [{googleSearch: {}}],
            thinkingConfig: { thinkingBudget: 32768 },
          },
      });
      setState(prevState => ({ ...prevState, chatSession: chat }));
      
      const prompt = getProfilerPrompt(profilerData.urlInput, state.analysisAspects, state.correctionInput);
      
      setProfilingProgressMessage('Generating insights...');
      const stream = await chat.sendMessageStream({ message: prompt });

      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        const parts = fullResponse.split('---[SPLIT]---');
        const insights = parts[0] || '';
        const profile = parts[1] || '';
        
        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
        setProfilerData(prevState => ({
            ...prevState,
            analysisResult: { insights, profile },
            sources: groundingChunks || prevState.sources
        }));
      }
      
      const finalParts = fullResponse.split('---[SPLIT]---');
      const finalInsights = finalParts[0]?.trim() || '';
      const finalProfile = finalParts[1]?.trim() || '';
      setGeneralProfile({
        insights: finalInsights,
        profile: finalProfile,
        sourceUrl: profilerData.urlInput,
      });

    } catch (error) {
      console.error("Error during analysis:", error);
      setState(prevState => ({
        ...prevState,
        error: "An error occurred. Please check the URL or try again.",
      }));
    } finally {
        setIsProfilingGlobal(false);
        setState(prevState => ({ ...prevState, isStreaming: false }));
    }
  };
  
  const handleCompareClick = async () => {
    const isUrlOneValid = isValidUrl(profilerData.urlInput);
    const isUrlTwoValid = isValidUrl(state.urlInputTwo);
    
    if (!isUrlOneValid || !isUrlTwoValid) {
        let errorMessage = '';
        if (!isUrlOneValid && !isUrlTwoValid) {
            errorMessage = 'Please enter valid URLs for both companies, starting with http:// or https://.';
        } else if (!isUrlOneValid) {
            errorMessage = 'The URL for Company 1 is not valid. Please ensure it starts with http:// or https://.';
        } else {
            errorMessage = 'The URL for Company 2 is not valid. Please ensure it starts with http:// or https://.';
        }
        setState(prevState => ({ ...prevState, error: errorMessage }));
        return;
    }

    const selectedAspectKeys = Object.entries(state.analysisAspects)
      .filter(([, isSelected]) => isSelected)
      .map(([key]) => key);

    if (selectedAspectKeys.length === 0 && state.analysisType === 'General Summary') {
      setState(prevState => ({ ...prevState, error: 'Please select at least one analysis aspect.' }));
      return;
    }
    
    onClear();

    setIsProfilingGlobal(true);
    setProfilingProgressMessage('Comparing companies...');
    setState(prevState => ({
      ...prevState,
      isStreaming: true,
      error: '',
      chatSession: null,
    }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({
        model: 'gemini-2.5-pro',
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 32768 },
        },
      });
      setState(prevState => ({ ...prevState, chatSession: chat }));

      const selectedAspectLabels = selectedAspectKeys
        .map(key => aspectOptions.find(opt => opt.key === key)?.label);

      let prompt = `Perform a comparative M&A analysis of the company at URL 1: ${profilerData.urlInput} and the company at URL 2: ${state.urlInputTwo}. Based on public info, generate a concise comparison. Format in markdown.\n`;

      switch (state.analysisType) {
        case 'SWOT Analysis':
          prompt += 'Your primary task is to create a comparative **SWOT Analysis**, highlighting similarities and differences in their Strengths, Weaknesses, Opportunities, and Threats.';
          break;
        case 'Investment Thesis':
          prompt += 'Your primary task is to formulate a comparative **Investment Thesis**, evaluating which company presents a more compelling acquisition target and why.';
          break;
        case 'General Summary':
        default:
          prompt += `Please compare them across these points: ${selectedAspectLabels.join(', ')}. Conclude with a summary of which might be a better acquisition target.`;
          break;
      }
      
      if (state.specificAsk.trim()) {
        prompt += `\n\nAdditionally, please specifically answer this question in the context of the comparison: "${state.specificAsk}"`;
      }

      const stream = await chat.sendMessageStream({ message: prompt });

      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
        setProfilerData(prevState => ({
          ...prevState,
          analysisResult: { ...prevState.analysisResult, profile: fullResponse },
          sources: groundingChunks || prevState.sources,
        }));
      }
    } catch (error) {
      console.error("Error during comparison:", error);
      setState(prevState => ({
        ...prevState,
        error: "An error occurred during comparison. Please check the URLs or try again.",
      }));
    } finally {
      setIsProfilingGlobal(false);
      setState(prevState => ({ ...prevState, isStreaming: false }));
    }
  };
  
  const handleDocumentAnalyzeClick = async () => {
    if (!state.uploadedFile) {
        setState(prevState => ({ ...prevState, error: 'Please upload a document to analyze.' }));
        return;
    }
    if (!state.companyNameInput.trim()) {
        setState(prevState => ({ ...prevState, error: 'Please enter a company name for this deal.' }));
        return;
    }
    
    onClear();

    setIsProfilingGlobal(true);
    setProfilingProgressMessage(`Analyzing ${state.uploadedFile.name}...`);
    setState(prevState => ({
        ...prevState,
        isStreaming: true, // Set to true to show "Generating..."
        error: '',
        chatSession: null,
    }));

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const base64Data = await fileToBase64(state.uploadedFile);

        const filePart = {
            inlineData: {
                data: base64Data,
                mimeType: state.uploadedFile.type,
            },
        };

        let prompt = `Analyze the attached document (${state.uploadedFile.name}) and generate a concise M&A analysis based on its contents. Format in markdown.\n`;

        switch (state.analysisType) {
            case 'SWOT Analysis':
                prompt += 'Your primary task is to create a detailed **SWOT Analysis** (Strengths, Weaknesses, Opportunities, Threats) based on the document.';
                break;
            case 'Investment Thesis':
                prompt += 'Your primary task is to formulate a concise **Investment Thesis** based on the document, outlining the core reasons why the described company would be a compelling acquisition target.';
                break;
            case 'General Summary':
            default:
                prompt += 'Provide a general summary of the key information relevant for an M&A deal.';
                break;
        }

        if (state.specificAsk.trim()) {
            prompt += `\n\nAdditionally, please specifically answer this question using the document as the primary source: "${state.specificAsk}"`;
        }

        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [textPart, filePart] },
            config: { thinkingConfig: { thinkingBudget: 32768 } },
        });

        setProfilerData(prevState => ({
            ...prevState,
            analysisResult: { ...prevState.analysisResult, profile: response.text },
        }));

    } catch (error) {
        console.error("Error during document analysis:", error);
        setState(prevState => ({
            ...prevState,
            error: "An error occurred during document analysis. The file might be corrupted or in an unsupported format.",
        }));
    } finally {
        setIsProfilingGlobal(false);
        setState(prevState => ({ ...prevState, isStreaming: false }));
    }
  };
  
  const handleFollowUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!state.followUpInput.trim() || !state.chatSession || state.isStreaming) return;

    const userMessage = `\n\n<hr class="my-4 border-slate-300">\n\n<p class="font-semibold text-slate-800">You: ${state.followUpInput}</p>\n\n`;
    const fullPrompt = profilerData.analysisResult.profile + userMessage;

    setState(prevState => ({ ...prevState, isStreaming: true, followUpInput: '', error: '' }));
    setProfilerData(prev => ({...prev, analysisResult: { ...prev.analysisResult, profile: fullPrompt }}));

    try {
        const stream = await state.chatSession.sendMessageStream({ message: state.followUpInput });
        
        let tempResult = fullPrompt;
        for await (const chunk of stream) {
            tempResult += chunk.text;
            setProfilerData(prev => ({ ...prev, analysisResult: { ...prev.analysisResult, profile: tempResult } }));
        }
    } catch (error) {
        console.error("Error during follow-up:", error);
        setState(prevState => ({ ...prevState, error: "An error occurred during the follow-up." }));
    } finally {
        setState(prevState => ({ ...prevState, isStreaming: false }));
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state.profilerMode === 'single') {
        handleAnalyzeClick();
    } else if (state.profilerMode === 'compare') {
        handleCompareClick();
    } else {
        handleDocumentAnalyzeClick();
    }
  }

  const handleCopyClick = () => {
    const { insights, profile } = profilerData.analysisResult;
    if (!insights && !profile) return;
    const contentToCopy = `Key Insights & Potential Red Flags\n\n${insights}\n\n---\n\nCompany Profile\n\n${profile}`;
    const plainText = contentToCopy.replace(/<[^>]*>?/gm, '');
    navigator.clipboard.writeText(plainText);
    setState(prevState => ({ ...prevState, copied: true }));
    setTimeout(() => setState(prevState => ({ ...prevState, copied: false })), 2000);
  };

  const handleExportClick = () => {
    const { insights, profile } = profilerData.analysisResult;
    if (!insights && !profile) return;
    const contentToExport = `Key Insights & Red Flags\n\n${insights}\n\n---\n\nCompany Profile\n\n${profile}`;
    const plainText = contentToExport.replace(/<[^>]*>?/gm, '');
    const sanitizedUrl = profilerData.urlInput.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `profile_${sanitizedUrl}.txt`;
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveChatClick = () => {
    if (!profilerData.analysisResult.profile) return;
    localStorage.setItem('companyProfilerChatHistory', profilerData.analysisResult.profile);
    setState(prevState => ({ ...prevState, saved: true }));
    setTimeout(() => setState(prevState => ({ ...prevState, saved: false })), 2000);
  };

  const handleCorrectionToggle = () => {
    setState(prevState => ({
      ...prevState,
      isCorrecting: !prevState.isCorrecting,
      correctionInput: '', // Reset on toggle
      error: '',
    }));
  };

  const handleReanalyzeClick = async () => {
    if (!state.correctionInput.trim()) {
      setState(prevState => ({ ...prevState, error: 'Please provide correction details.' }));
      return;
    }
    await handleAnalyzeClick(); 
  };
  
  const handleReanalyzeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleReanalyzeClick();
  };

  const isDealInPipeline = useMemo(() => {
    if (!state.companyNameInput.trim()) return false;
    return deals.some(deal => deal.companyName.toLowerCase() === state.companyNameInput.trim().toLowerCase());
  }, [deals, state.companyNameInput]);

  const handleAddToPipelineClick = () => {
    if (!state.uploadedFile || !state.companyNameInput.trim() || !isAnalyzed) {
        setState(prev => ({ ...prev, error: 'Please ensure a document is analyzed and a company name is provided.' }));
        return;
    }

    const syntheticSourcingResult: SourcingResult = {
        url: `cim://${state.uploadedFile.name}`,
        title: state.companyNameInput.trim(),
        keyInsights: profilerData.analysisResult.insights,
        fullProfile: profilerData.analysisResult.profile,
        scorecard: '### No Scorecard Generated\nA scorecard has not been generated for this document-based deal. You can perform a "Buy Box Fit Analysis" to generate one.',
        overallFitScore: null,
        sde: null,
        industry: null,
    };

    onAddToPipeline(syntheticSourcingResult);
  };
  
  const noAspectsSelected = Object.values(state.analysisAspects).every(v => !v);
  const isAnalyzeButtonDisabled = isProfilingGlobal || state.isStreaming ||
    (state.profilerMode === 'single' && (!profilerData.urlInput.trim() || (state.analysisType === 'General Summary' && noAspectsSelected))) ||
    (state.profilerMode === 'compare' && (!profilerData.urlInput.trim() || !state.urlInputTwo.trim() || (state.analysisType === 'General Summary' && noAspectsSelected))) ||
    (state.profilerMode === 'document' && (!state.uploadedFile || !state.companyNameInput.trim()));

  const analysisContentAvailable = profilerData.analysisResult.profile || profilerData.analysisResult.insights;
  const isAnalyzing = isProfilingGlobal || state.isStreaming;
  
  const inputClasses = "w-full px-4 py-3 text-base text-slate-700 bg-slate-100 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition placeholder-slate-400 disabled:opacity-70";
  const selectClasses = `${inputClasses} appearance-none`;

  return (
    <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-4xl mx-auto border border-slate-200">
      
      <div className="bg-slate-100 p-1 rounded-xl flex items-center justify-between mb-8 shadow-inner">
        <button
          onClick={() => handleModeChange('single')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${state.profilerMode === 'single' ? 'bg-white shadow border-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200/50'}`}
        >
          Single Profile
        </button>
        <button
          onClick={() => handleModeChange('document')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${state.profilerMode === 'document' ? 'bg-white shadow border-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200/50'}`}
        >
          Analyze Document
        </button>
        <button
          onClick={() => handleModeChange('compare')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${state.profilerMode === 'compare' ? 'bg-white shadow border-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-200/50'}`}
        >
          Compare Companies
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-5">
        {state.profilerMode === 'single' && (
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Website URL</label>
                 <input
                    type="text"
                    value={profilerData.urlInput}
                    onChange={handleUrlChange}
                    placeholder="https://example.com"
                    className={inputClasses}
                    disabled={isAnalyzing}
                />
            </div>
        )}
        {state.profilerMode === 'compare' && (
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company URLs to Compare</label>
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <input
                        type="text"
                        value={profilerData.urlInput}
                        onChange={handleUrlChange}
                        placeholder="Company 1 URL"
                        className={inputClasses}
                        disabled={isAnalyzing}
                    />
                    <input
                        type="text"
                        value={state.urlInputTwo}
                        onChange={handleUrlTwoChange}
                        placeholder="Company 2 URL"
                        className={inputClasses}
                        disabled={isAnalyzing}
                    />
                </div>
            </div>
        )}
        {state.profilerMode === 'document' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
                <input
                    type="text"
                    value={state.companyNameInput}
                    onChange={(e) => setState(prev => ({ ...prev, companyNameInput: e.target.value }))}
                    placeholder="Enter Company Name for this Deal"
                    className={inputClasses}
                    disabled={isAnalyzing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Upload Document</label>
                <div 
                    className={`border-2 border-dashed border-slate-300 rounded-lg py-10 px-6 text-center bg-slate-50 transition ${isAnalyzing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-slate-100 hover:border-amber-500'}`}
                    onDragOver={isAnalyzing ? undefined : handleDragOver}
                    onDrop={isAnalyzing ? undefined : handleDrop}
                    onClick={isAnalyzing ? undefined : () => document.getElementById('file-upload-input')?.click()}
                >
                    <input 
                        type="file" 
                        id="file-upload-input" 
                        className="hidden" 
                        onChange={(e) => handleFileChange(e.target.files)} 
                        accept=".pdf,.pptx"
                        disabled={isAnalyzing}
                    />
                    <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="mt-4 text-base text-slate-600">
                        <span className="font-semibold text-amber-600">Click to upload CIM</span> or drag and drop
                    </p>
                    <p className="mt-1 text-xs text-slate-500">PDF or PPTX</p>
                    {state.uploadedFile && (
                        <p className="mt-4 inline-block rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700 break-all">
                            Selected: {state.uploadedFile.name}
                        </p>
                    )}
                </div>
              </div>
            </div>
        )}
        
        <div>
             <label className="block text-sm font-medium text-slate-700 mb-2">Ask a specific question (optional)</label>
             <textarea
                value={state.specificAsk}
                onChange={(e) => setState({ ...state, specificAsk: e.target.value })}
                placeholder="e.g., What are the main growth opportunities?"
                className={inputClasses}
                rows={3}
                disabled={isAnalyzing}
            />
        </div>
        
        <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Type</label>
            <select
                value={state.analysisType}
                onChange={(e) => setState({ ...state, analysisType: e.target.value as AnalysisType })}
                className={selectClasses}
                disabled={isAnalyzing}
            >
                <option>General Summary</option>
                <option>SWOT Analysis</option>
                <option>Investment Thesis</option>
            </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 top-6 flex items-center px-3 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 20 20" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 8l4 4 4-4" /></svg>
            </div>
        </div>

        {state.analysisType === 'General Summary' && state.profilerMode !== 'document' && (
            <div className="pt-2">
                <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-slate-700">Analysis Focus</label>
                    <div className="flex items-center">
                        <input
                            id="select-all-aspects"
                            type="checkbox"
                            ref={selectAllCheckboxRef}
                            onChange={handleSelectAllChange}
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <label htmlFor="select-all-aspects" className="ml-2 text-sm font-medium text-slate-700">
                            Select / Deselect All
                        </label>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                    {aspectOptions.map(aspect => (
                        <label key={aspect.key as string} className={`flex items-center space-x-3 ${isAnalyzing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                            <input
                                type="checkbox"
                                name={aspect.key as string}
                                checked={state.analysisAspects[aspect.key]}
                                onChange={handleAspectChange}
                                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                disabled={isAnalyzing}
                            />
                            <span className="text-sm text-slate-700">{aspect.label}</span>
                        </label>
                    ))}
                </div>
            </div>
        )}
        
        <div className="pt-2">
            <button
                type="submit"
                className="w-full px-8 py-3.5 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition duration-200 ease-in-out disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
                disabled={isAnalyzeButtonDisabled}
            >
                {isProfilingGlobal ? 'Analyzing...' : (state.isStreaming ? 'Generating...' : 'Analyze')}
            </button>
        </div>
      </form>
      
      {state.error && <p className="text-red-600 text-sm mt-4 px-1">{state.error}</p>}

      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 min-h-[200px] mt-6">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-slate-700">Analysis Result</h3>
          <div className="flex items-center gap-2">
            {state.profilerMode === 'document' && analysisContentAvailable && (
                <button
                    onClick={handleAddToPipelineClick}
                    disabled={isDealInPipeline || isAnalyzing}
                    className="px-4 py-2 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 disabled:bg-slate-300 disabled:text-green-800/50 disabled:cursor-not-allowed transition"
                    title={isDealInPipeline ? "This deal is already in your pipeline" : "Add this analysis to your deal pipeline"}
                >
                    {isDealInPipeline ? 'In Pipeline' : 'Add to Pipeline'}
                </button>
            )}
            <button
                onClick={onClear}
                disabled={!analysisContentAvailable || isAnalyzing}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                Clear
            </button>
            <button
              onClick={handleCopyClick}
              disabled={!analysisContentAvailable || isAnalyzing}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {state.copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleExportClick}
              disabled={!analysisContentAvailable || isAnalyzing}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Export
            </button>
            {state.profilerMode === 'single' &&
              <button
                onClick={handleSaveChatClick}
                disabled={!profilerData.analysisResult.profile || isAnalyzing}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {state.saved ? 'Saved!' : 'Save Chat'}
              </button>
            }
          </div>
        </div>
        {isProfilingGlobal ? (
           <div className="text-slate-500 text-center flex flex-col items-center justify-center h-full pt-8">
             <svg className="animate-spin h-6 w-6 text-amber-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
             <p>{profilingProgressMessage}</p>
           </div>
        ) : isAnalyzed ? (
          <div>
            {profilerData.analysisResult.insights && (
              <div className="mb-6 pb-6 border-b border-slate-200">
                <h4 className="text-md font-semibold text-slate-700 mb-3">Key Insights & Red Flags</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(profilerData.analysisResult.insights)} />
              </div>
            )}
            {profilerData.analysisResult.profile && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-slate-700 mb-3">Company Profile</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(profilerData.analysisResult.profile)} />
              </div>
            )}
            {profilerData.sources && profilerData.sources.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-md font-semibold text-slate-700 mb-3">Sources</h4>
                <ul className="space-y-2">
                  {profilerData.sources.map((source, index) => (
                    <li key={index} className="text-sm">
                      <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 hover:underline transition-colors">
                        {source.web.title || source.web.uri}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500 text-center flex items-center justify-center h-full pt-8">
            <p>
                {state.profilerMode === 'single' 
                    ? 'Enter a company website to generate a profile.' 
                    : state.profilerMode === 'compare'
                    ? 'Enter two company websites to generate a comparison.'
                    : 'Upload a pitch deck or report to begin analysis.'
                }
            </p>
          </div>
        )}
      </div>

      {isAnalyzed && state.profilerMode === 'single' && (
        state.isCorrecting ? (
          <form onSubmit={handleReanalyzeSubmit} className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-200">
            <label htmlFor="correctionInput" className="block text-sm font-medium text-slate-700 mb-2">Provide correction details to refine the analysis</label>
            <textarea
              id="correctionInput"
              value={state.correctionInput}
              onChange={(e) => setState(prevState => ({ ...prevState, correctionInput: e.target.value }))}
              placeholder="e.g., 'The company is not public, focus on their B2B services instead of consumer products.'"
              className={inputClasses}
              rows={3}
              aria-label="Correction input"
            />
            <div className="flex items-center justify-end gap-3 mt-3">
              <button
                type="button"
                onClick={handleCorrectionToggle}
                className="px-6 py-2 font-medium text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                disabled={!state.correctionInput.trim() || state.isStreaming || isProfilingGlobal}
              >
                {isAnalyzing ? 'Re-analyzing...' : 'Re-analyze'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6">
            <form onSubmit={handleFollowUpSubmit}>
              <label htmlFor="followUpInput" className="block text-sm font-medium text-slate-700 mb-2">Ask a follow-up question</label>
              <div className="flex items-center gap-3">
                <input
                  id="followUpInput"
                  type="text"
                  value={state.followUpInput}
                  onChange={(e) => setState({ ...state, followUpInput: e.target.value })}
                  placeholder="e.g., 'Tell me more about their competitors.'"
                  className={inputClasses}
                  disabled={isAnalyzing}
                />
                <button
                  type="submit"
                  className="px-8 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                  disabled={!state.followUpInput.trim() || isAnalyzing}
                >
                  {state.isStreaming ? '...' : 'Send'}
                </button>
              </div>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-2 px-1">
                <span className="text-sm text-slate-500 mr-2 font-medium">Try asking:</span>
                {examplePrompts.map((prompt, index) => (
                    <button
                        key={index}
                        type="button"
                        onClick={() => setState(prevState => ({ ...prevState, followUpInput: prompt }))}
                        className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-full hover:bg-amber-200 transition-colors"
                    >
                        "{prompt}"
                    </button>
                ))}
            </div>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleCorrectionToggle}
                className="px-5 py-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition"
              >
                Found an error? Correct the analysis.
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default CompanyProfiler;
