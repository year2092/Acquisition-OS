import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { BuyBoxCriteria, GeneralProfileResult, FitAnalysisData, SavedProfile } from '../src/App';
import { renderMarkdown } from '../src/utils/markdownRenderer';

interface BuyBoxProps {
  buyBox: BuyBoxCriteria;
  setBuyBox: React.Dispatch<React.SetStateAction<BuyBoxCriteria>>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  generalProfile: GeneralProfileResult | null;
  savedProfiles: SavedProfile[];
  currentProfileName: string | null;
  onSaveProfile: (name: string) => void;
  onLoadProfile: (name: string) => void;
  onDeleteProfile: (name: string) => void;
  onRenameProfile: (oldName: string, newName: string) => void;
  onNewProfile: () => void;
  fitAnalysis: FitAnalysisData;
  setFitAnalysis: React.Dispatch<React.SetStateAction<FitAnalysisData>>;
  onClearFitAnalysis: () => void;
}

interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

interface BuyBoxState {
    isAnalyzingFit: boolean;
    fitAnalysisError: string;
    chatSession: Chat | null;
    isStreaming: boolean;
    followUpInput: string;
}

const inputClasses = "w-full bg-slate-100 text-slate-800 border-slate-200 rounded-md py-2 px-3 text-sm transition focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder:text-slate-400";
const checkboxLabelClasses = "text-slate-700 text-sm flex items-center gap-2 cursor-pointer";

const BIZ_BUY_SELL_INDUSTRIES = {
  "Automotive & Transportation": ["Auto Repair", "Gas Stations", "Car Wash", "Towing", "Used Car Dealers", "Trucking"],
  "Business Services": ["Advertising", "Business Brokerage", "Cleaning", "Consulting", "Employment Agencies", "Financial Services", "Insurance", "Printing", "Security"],
  "Construction & Contracting": ["Building Materials", "Construction Companies", "Electrical Contractors", "HVAC", "Landscaping", "Painting", "Plumbing", "Roofing"],
  "Food & Restaurant": ["Bars & Pubs", "Coffee Shops", "Fast Food", "Pizza", "Restaurants", "Food Trucks"],
  "Health Care & Fitness": ["Dental", "Fitness Centers", "Home Health Care", "Medical Practices", "Pharmacies", "Senior Care"],
  "Manufacturing": ["Apparel", "Chemical", "Electronics", "Food Production", "Machine Shops", "Metal Work", "Plastics"],
  "Real Estate": ["Property Management", "Real Estate Agency"],
  "Retail": ["Apparel Stores", "Convenience Stores", "E-Commerce", "Flower Shops", "Grocery Stores", "Liquor Stores", "Pet Stores"],
  "Service Businesses": ["Beauty & Salons", "Child Care", "Dry Cleaning", "Funeral Homes", "Pet Grooming", "Travel Agencies"],
  "Technology": ["IT Services", "SaaS", "Software Companies", "Web Development"],
  "Wholesale & Distribution": ["Distribution", "Import/Export", "Vending"],
  "Other": []
};

const tooltipTexts = {
    industryType: "Specify the target industries. This helps focus your search on markets you understand and where you can add value.",
    minSde: "Seller's Discretionary Earnings (SDE) is a measure of a small business's cash flow. Set the minimum SDE you're willing to consider.",
    maxSde: "Set the maximum SDE to define the upper limit of your search, ensuring deals are within your financial reach.",
    minRecurringRevenue: "High recurring revenue (from subscriptions, contracts, etc.) indicates stable and predictable cash flow, reducing risk.",
    customerConcentration: "Set a maximum percentage of revenue from a single customer. High concentration is a risk if that customer leaves.",
    industryTrends: "Describe desired market characteristics. Are you looking for a growing, fragmented market ripe for consolidation, or a stable, mature one?",
    growthLevers: "Identify the primary ways you plan to grow the business. This helps find companies with potential that matches your skills.",
    sellerRole: "The seller's current role is crucial. An absentee owner is easier to transition from than a key person who is central to all operations.",
    businessModel: "Asset-light businesses often have higher margins and scalability. Asset-heavy businesses have significant physical assets, which can be a barrier to entry.",
    teamStrength: "Assess the quality of the existing team. A strong team is a major asset that can ensure a smooth transition and continued success.",
    systemMessiness: "Evaluate the state of the company's internal systems (e.g., CRM, accounting). Messy systems can require significant post-acquisition cleanup.",
    myPrimaryRole: "Define your intended role post-acquisition. Will you run the daily operations or manage an existing leader?",
    geography: "Define the geographic area for your search, such as a specific commute time, city, or state.",
    desiredCulture: "Describe the ideal company culture. A good cultural fit is critical for employee retention and a successful integration.",
    desiredCultureRationale: "Explain why this culture is important to you. For example, 'A collaborative culture reduces management overhead and improves team morale.'",
    personalGoal: "What is your primary personal motivation for this acquisition? This helps align the deal with your long-term life and career goals.",
    personalGoalRationale: "Explain how this deal helps you achieve your personal goal. For example, 'Achieving flexibility allows me to spend more time with family, which is my top priority.'",
    industryExpertise: "List industries where you have direct experience. This helps in identifying deals where your knowledge can be a significant advantage for due diligence and post-acquisition growth."
};

const criteriaNameToKeyMap: { [key: string]: keyof BuyBoxCriteria | null } = {
    'Geography': 'geography',
    'Industry': 'industryType',
    'Financials (SDE)': 'minSde',
    'Revenue Quality': 'minRecurringRevenue',
    'Risk (Concentration)': 'customerConcentration',
    'Growth Levers': 'growthLevers',
    'Industry Trends': 'industryTrends',
    'Seller Role': 'sellerRole',
    'Team Strength': 'teamStrength',
    'Business Model': 'businessModel',
    'Systems': 'systemMessiness',
    'My Role': 'myPrimaryRole',
    'Industry Expertise': 'industryExpertise',
    'Culture': null,
};

const calculateOverallFitScore = (scorecard: string, buyBox: BuyBoxCriteria): number | null => {
    if (!scorecard) return null;

    let achievedScore = 0;
    let totalPossibleScore = 0;

    for (const key in buyBox) {
        const criteria = buyBox[key as keyof BuyBoxCriteria];
        if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria) && 'weight' in criteria && typeof criteria.weight === 'number') {
            totalPossibleScore += criteria.weight;
        }
    }

    if (buyBox.minSde.weight > 0 && buyBox.maxSde.weight > 0) {
        totalPossibleScore -= buyBox.maxSde.weight;
    }

    if (totalPossibleScore === 0) return 50; 

    const rows = scorecard.split('\n').slice(2);
    rows.forEach(row => {
        const columns = row.split('|').map(c => c.trim());
        if (columns.length >= 4) {
            const criteriaNameWithWeight = columns[1];
            const criteriaName = criteriaNameWithWeight.split(' (Weight:')[0].trim().replace(/\*\*/g, '');
            
            const fit = columns[3].toLowerCase().replace(/<[^>]+>/g, '');
            const buyBoxKey = criteriaNameToKeyMap[criteriaName];

            if (buyBoxKey) {
                const criteria = buyBox[buyBoxKey as keyof BuyBoxCriteria];
                 if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria) && 'weight' in criteria && typeof criteria.weight === 'number') {
                    const weight = criteria.weight;
                    if (fit === 'yes') {
                        achievedScore += weight;
                    } else if (fit === '?') {
                        achievedScore += weight * 0.3; 
                    }
                }
            }
        }
    });
    
    return Math.round((achievedScore / totalPossibleScore) * 100);
};

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const FormLabelWithTooltip: React.FC<{ htmlFor: string; label: string; tooltipText: string }> = ({ htmlFor, label, tooltipText }) => (
    <div className="flex items-center gap-1.5 mb-1.5">
        <label htmlFor={htmlFor} className="text-slate-600 text-sm font-medium">{label}</label>
        <div className="relative flex items-center group">
            <InfoIcon />
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[280px] bg-slate-800 text-slate-100 text-sm text-left rounded-lg p-3 border border-slate-600 shadow-lg z-10 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                {tooltipText}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-slate-800"></div>
            </div>
        </div>
    </div>
);

const BuyBox: React.FC<BuyBoxProps> = ({ buyBox, setBuyBox, undo, redo, canUndo, canRedo, generalProfile, savedProfiles, currentProfileName, onSaveProfile, onLoadProfile, onDeleteProfile, onRenameProfile, onNewProfile, fitAnalysis, setFitAnalysis, onClearFitAnalysis }) => {
  const [state, setState] = useState<BuyBoxState>({
    isAnalyzingFit: false,
    fitAnalysisError: '',
    chatSession: null,
    isStreaming: false,
    followUpInput: '',
  });
  
  const [minSdeDisplay, setMinSdeDisplay] = useState(buyBox.minSde.value.toLocaleString());
  const [maxSdeDisplay, setMaxSdeDisplay] = useState(buyBox.maxSde.value.toLocaleString());

  const [selectedSector, setSelectedSector] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [profileNameForSave, setProfileNameForSave] = useState('');

  // Sync with external changes from undo/redo
  useEffect(() => { setMinSdeDisplay(buyBox.minSde.value.toLocaleString()); }, [buyBox.minSde.value]);
  useEffect(() => { setMaxSdeDisplay(buyBox.maxSde.value.toLocaleString()); }, [buyBox.maxSde.value]);

  useEffect(() => {
    const industryValue = buyBox.industryType.value;
    let foundSector = '';
    if (industryValue) {
        for (const sector in BIZ_BUY_SELL_INDUSTRIES) {
            if (sector === industryValue) { foundSector = sector; break; }
            if ((BIZ_BUY_SELL_INDUSTRIES as any)[sector].includes(industryValue)) { foundSector = sector; break; }
        }
    }
    if (foundSector) setSelectedSector(foundSector);
    else if (industryValue) setSelectedSector('Other');
    else setSelectedSector('');
  }, [buyBox.industryType.value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setBuyBox((prev) => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  };

  const handleNestedChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const isNumber = e.target.type === 'number';
    setBuyBox((prev) => {
      const field = prev[name as keyof BuyBoxCriteria];
      if (typeof field === 'object' && field !== null && !Array.isArray(field) && 'value' in field) {
        return { ...prev, [name]: { ...(field as object), value: isNumber ? parseFloat(value) || 0 : value } };
      }
      return prev;
    });
  };

  const handleSdeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const cleanedValue = value.replace(/[^0-9]/g, '');
    if (name === 'minSde') setMinSdeDisplay(cleanedValue);
    else if (name === 'maxSde') setMaxSdeDisplay(cleanedValue);
  };

  const handleSdeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numericValue = parseInt(value.replace(/,/g, ''), 10) || 0;
    if (name === 'minSde') {
      setBuyBox(prev => ({ ...prev, minSde: { ...prev.minSde, value: numericValue } }));
      setMinSdeDisplay(numericValue.toLocaleString());
    } else if (name === 'maxSde') {
      setBuyBox(prev => ({ ...prev, maxSde: { ...prev.maxSde, value: numericValue } }));
      setMaxSdeDisplay(numericValue.toLocaleString());
    }
  };

  const handleLeverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setBuyBox((prev) => ({ ...prev, growthLevers: { ...prev.growthLevers, [name]: checked } }));
  };

  const handleAnalyzeFitClick = async () => {
    if (!generalProfile || !generalProfile.profile) {
      setState(prev => ({...prev, fitAnalysisError: 'Please generate a company profile first using the Company Profiler.'}));
      return;
    }
    
    onClearFitAnalysis();
    setState(prev => ({...prev, isAnalyzingFit: true, fitAnalysisError: '', chatSession: null}));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({
          model: 'gemini-2.5-pro',
          config: { tools: [{googleSearch: {}}], thinkingConfig: { thinkingBudget: 32768 } },
      });
      setState(prevState => ({ ...prevState, chatSession: chat }));

      const growthLeversText = Object.entries(buyBox.growthLevers).filter(([,v]) => v).map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ') || 'Not specified';
      const industryExpertiseText = buyBox.industryExpertise.length > 0 ? buyBox.industryExpertise.map(e => `${e.industry} (${e.proficiency})`).join(', ') : 'Not specified';

      const fitAnalysisPrompt = `You are an M&A analyst. Your task is to score a target company against a user's "Buy Box" acquisition criteria, based on a previously generated profile summary.
**User's Buy Box Criteria (with priority weight):**
* **Geography (Weight: ${buyBox.geography.weight}):** ${buyBox.geography.value || 'Not specified'}
* **Industry (Weight: ${buyBox.industryType.weight}):** ${buyBox.industryType.value || 'Not specified'}
* **Industry Expertise:** ${industryExpertiseText}
* **Financials (SDE) (Weight: ${buyBox.minSde.weight}):** $${buyBox.minSde.value.toLocaleString()} - $${buyBox.maxSde.value.toLocaleString()}
* **Revenue Quality (Weight: ${buyBox.minRecurringRevenue.weight}):** Min. ${buyBox.minRecurringRevenue.value}% recurring
* **Risk (Concentration) (Weight: ${buyBox.customerConcentration.weight}):** Max. ${buyBox.customerConcentration.value}% from a single customer
* **Growth Levers (Weight: ${buyBox.growthLevers.weight}):** ${growthLeversText}
* **Industry Trends (Weight: ${buyBox.industryTrends.weight}):** ${buyBox.industryTrends.value || 'Not specified'}
* **Seller Role (Weight: ${buyBox.sellerRole.weight}):** ${buyBox.sellerRole.value || 'Not specified'}
* **Team Strength (Weight: ${buyBox.teamStrength.weight}):** ${buyBox.teamStrength.value || 'Not specified'}
* **Business Model (Weight: ${buyBox.businessModel.weight}):** ${buyBox.businessModel.value || 'Not specified'}
* **Systems (Weight: ${buyBox.systemMessiness.weight}):** ${buyBox.systemMessiness.value} (1=Messy, 5=Clean)
* **My Role (Weight: ${buyBox.myPrimaryRole.weight}):** ${buyBox.myPrimaryRole.value || 'Not specified'}
* **Culture:** ${buyBox.desiredCulture || 'Not specified'}

**Previously Generated Company Profile Summary:** """ ${generalProfile.profile} """
**Previously Identified General Insights/Red Flags:** """ ${generalProfile.insights} """

**Your Task:** Generate ONLY the "Buy Box Fit Scorecard". Present this as a Markdown table with four columns: "Criteria", "Target's Status", "Fit (Yes/No/?)", and "Rationale".
*   The "Criteria" column in your response table MUST include the weight, for example: "**Geography** (Weight: 2)".
*   If the information is not available in the provided text, **use your search tool to find the most up-to-date and accurate information.**
*   If you still cannot find the information after searching, mark the Status as "Unknown" and Fit as "?".
*   The "Rationale" must be a 1-sentence explanation for your "Fit" assessment, referencing the information you found (either from the profile or from your search).`;
        
      const stream = await chat.sendMessageStream({ message: fitAnalysisPrompt });
      
      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk.text;
        const fitAnalysisSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
        setFitAnalysis(prev => ({
            ...prev,
            scorecardResult: fullResponse,
            fitAnalysisSources: fitAnalysisSources || prev.fitAnalysisSources,
        }));
      }

      const score = calculateOverallFitScore(fullResponse, buyBox);
      setFitAnalysis(prev => ({ ...prev, overallFitScore: score }));

    } catch (error) {
        console.error("Error during fit analysis:", error);
        setState(prev => ({...prev, fitAnalysisError: "An error occurred during the fit analysis. Please try again."}));
    } finally {
        setState(prev => ({...prev, isAnalyzingFit: false}));
    }
  };
  
  const handleFitFollowUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!state.followUpInput.trim() || !state.chatSession || state.isStreaming) return;

    const userMessage = `\n\n<hr class="my-4 border-slate-200" />\n\n<p class="font-semibold text-slate-800">You: ${state.followUpInput}</p>\n\n`;
    
    setState(prevState => ({ ...prevState, isStreaming: true, followUpInput: '' }));
    setFitAnalysis(prev => ({...prev, scorecardResult: prev.scorecardResult + userMessage }));

    try {
        const stream = await state.chatSession.sendMessageStream({ message: state.followUpInput });
        
        let tempResult = fitAnalysis.scorecardResult + userMessage;
        for await (const chunk of stream) {
            tempResult += chunk.text;
            setFitAnalysis(prev => ({ ...prev, scorecardResult: tempResult }));
        }
    } catch (error) {
        console.error("Error during fit follow-up:", error);
        setState(prevState => ({ ...prevState, fitAnalysisError: "An error occurred during the follow-up." }));
    } finally {
        setState(prevState => ({ ...prevState, isStreaming: false }));
    }
  };

  const handleAnalyzeFitMismatches = () => {
    const prompt = "Based on the Buy Box Fit Scorecard, what are the top 3 biggest risks or mismatches? For each, suggest a potential mitigation strategy or a key question to ask the seller.";
    setState(prevState => ({ ...prevState, followUpInput: prompt }));
  };

  const handleSectorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSector = e.target.value;
    setSelectedSector(newSector);
    const newValue = newSector === 'Other' ? '' : newSector;
    setBuyBox(prev => ({ ...prev, industryType: { ...prev.industryType, value: newValue } }));
  };

  const handleIndustryValueChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
      setBuyBox(prev => ({ ...prev, industryType: { ...prev.industryType, value: e.target.value } }));
  };
  
  const handleOpenSaveModal = () => {
    setProfileNameForSave(currentProfileName || '');
    setIsSaveModalOpen(true);
  };
  
  const handleSaveProfileClick = () => {
    if (!profileNameForSave.trim()) {
        alert("Please enter a profile name.");
        return;
    }
    onSaveProfile(profileNameForSave);
    setIsSaveModalOpen(false);
  };
  
  const handleRenameClick = () => {
    if (!currentProfileName || currentProfileName === 'Default') {
        alert("The 'Default' profile cannot be renamed.");
        return;
    }

    const newName = window.prompt(`Enter a new name for the "${currentProfileName}" profile:`, currentProfileName);

    if (newName && newName.trim() && newName.trim() !== currentProfileName) {
        onRenameProfile(currentProfileName, newName.trim());
    }
  };

  const handleDeleteClick = () => {
    if (!currentProfileName) return;
    onDeleteProfile(currentProfileName);
  };
  
  const getFitScoreColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-slate-500';
    if (score >= 75) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
        <div className="flex-grow w-full">
            <label htmlFor="load-profile" className="block text-sm font-medium text-slate-600 mb-1.5">Load Profile</label>
            <select id="load-profile" value={currentProfileName || ''} onChange={(e) => onLoadProfile(e.target.value)} className={`${inputClasses} border-amber-400`}>
                {savedProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                {!currentProfileName && <option value="" disabled>Unsaved Profile</option>}
            </select>
        </div>
        <div className="w-full sm:w-auto flex-shrink-0 pt-0 sm:pt-7 flex items-center gap-2 flex-wrap justify-end">
            <button
                type="button"
                onClick={handleRenameClick}
                disabled={!currentProfileName || currentProfileName === 'Default'}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title={currentProfileName === 'Default' ? "The Default profile cannot be renamed" : "Rename current profile"}
            >
                Rename
            </button>
            <button
                type="button"
                onClick={handleDeleteClick}
                disabled={!currentProfileName || currentProfileName === 'Default'}
                className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title={currentProfileName === 'Default' ? "The Default profile cannot be deleted" : "Delete current profile"}
            >
                Delete
            </button>
            <button
                type="button"
                onClick={handleOpenSaveModal}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 transition flex items-center justify-center gap-2"
            >
                Save Profile
            </button>
        </div>
      </div>
      
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl p-6 z-50 w-full max-w-md">
                <h3 className="text-lg font-semibold text-slate-800">Save Profile</h3>
                <p className="text-sm text-slate-500 mt-1">Enter a name to save or update this buy box profile.</p>
                <div className="mt-4">
                    <label htmlFor="profileName" className="text-sm font-medium text-slate-600">Profile Name</label>
                    <input
                        id="profileName"
                        type="text"
                        value={profileNameForSave}
                        onChange={(e) => setProfileNameForSave(e.target.value)}
                        placeholder="e.g., SaaS Focused"
                        className={`${inputClasses} mt-1 border-amber-500 focus:ring-amber-500`}
                    />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Cancel</button>
                    <button type="button" onClick={handleSaveProfileClick} className="px-4 py-2 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 transition">Save Profile</button>
                </div>
            </div>
        </div>
      )}

      {/* --- Strategic & Financial --- */}
      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-semibold text-slate-800 mb-6">Strategic & Financial</h3>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <FormLabelWithTooltip htmlFor="industryType" label="Industry" tooltipText={tooltipTexts.industryType} />
            <select id="industrySector" name="industrySector" value={selectedSector} onChange={handleSectorChange} className={inputClasses}>
                <option value="">Select a Sector...</option>
                {Object.keys(BIZ_BUY_SELL_INDUSTRIES).map(sector => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </div>
          <div>
            <FormLabelWithTooltip htmlFor="industryTrends" label="Industry Trends" tooltipText={tooltipTexts.industryTrends} />
            <input id="industryTrends" type="text" name="industryTrends" value={buyBox.industryTrends.value} onChange={handleNestedChange} placeholder="e.g., Growth, consolidation, etc." className={inputClasses} />
          </div>
          <div>
            <FormLabelWithTooltip htmlFor="minSde" label="Min SDE ($)" tooltipText={tooltipTexts.minSde} />
            <input id="minSde" type="text" name="minSde" value={minSdeDisplay} onChange={handleSdeChange} onBlur={handleSdeBlur} placeholder="$250,000" className={inputClasses} />
          </div>
          <div>
            <FormLabelWithTooltip htmlFor="maxSde" label="Max SDE ($)" tooltipText={tooltipTexts.maxSde} />
            <input id="maxSde" type="text" name="maxSde" value={maxSdeDisplay} onChange={handleSdeChange} onBlur={handleSdeBlur} placeholder="$2,000,000" className={inputClasses} />
          </div>
          <div>
            <FormLabelWithTooltip htmlFor="minRecurringRevenue" label="Min Recurring Revenue (%)" tooltipText={tooltipTexts.minRecurringRevenue} />
            <input id="minRecurringRevenue" type="number" name="minRecurringRevenue" value={buyBox.minRecurringRevenue.value} onChange={handleNestedChange} placeholder="70%" className={inputClasses} />
          </div>
          <div>
            <FormLabelWithTooltip htmlFor="customerConcentration" label="Max Customer Concentration (%)" tooltipText={tooltipTexts.customerConcentration} />
            <input id="customerConcentration" type="number" name="customerConcentration" value={buyBox.customerConcentration.value} onChange={handleNestedChange} placeholder="30%" className={inputClasses} />
          </div>
          <div className="md:col-span-2">
            <FormLabelWithTooltip htmlFor="" label="Growth Levers" tooltipText={tooltipTexts.growthLevers} />
            <div className="flex gap-6 flex-wrap mt-2">
              <label className={checkboxLabelClasses}><input type="checkbox" name="sales" checked={buyBox.growthLevers.sales} onChange={handleLeverChange} className="appearance-none h-4 w-4 border-2 border-slate-300 rounded-full checked:bg-amber-500 checked:border-amber-500 focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/50" /> Sales</label>
              <label className={checkboxLabelClasses}><input type="checkbox" name="ops" checked={buyBox.growthLevers.ops} onChange={handleLeverChange} className="appearance-none h-4 w-4 border-2 border-slate-300 rounded-full checked:bg-amber-500 checked:border-amber-500 focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/50" /> Operations</label>
              <label className={checkboxLabelClasses}><input type="checkbox" name="consolidation" checked={buyBox.growthLevers.consolidation} onChange={handleLeverChange} className="appearance-none h-4 w-4 border-2 border-slate-300 rounded-full checked:bg-amber-500 checked:border-amber-500 focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/50" /> Consolidation</label>
            </div>
          </div>
        </div>
      </div>

      {/* --- Operational & Risk --- */}
      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-semibold text-slate-800 mb-6">Operational & Risk</h3>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div><FormLabelWithTooltip htmlFor="sellerRole" label="Seller Role" tooltipText={tooltipTexts.sellerRole} /><select id="sellerRole" name="sellerRole" value={buyBox.sellerRole.value} onChange={handleNestedChange} className={inputClasses}><option value="">Select role</option><option value="any">Any / N/A</option><option value="absentee">Absentee Owner</option><option value="operator">Owner-Operator</option><option value="keyPerson">Key Person (Red Flag)</option></select></div>
            <div><FormLabelWithTooltip htmlFor="businessModel" label="Business Model" tooltipText={tooltipTexts.businessModel} /><select id="businessModel" name="businessModel" value={buyBox.businessModel.value} onChange={handleNestedChange} className={inputClasses}><option value="">Select model</option><option value="any">Any / N/A</option><option value="assetLight">Asset-Light</option><option value="assetHeavy">Asset-Heavy</option></select></div>
            <div><FormLabelWithTooltip htmlFor="teamStrength" label="Team Strength" tooltipText={tooltipTexts.teamStrength} /><input id="teamStrength" type="text" name="teamStrength" value={buyBox.teamStrength.value} onChange={handleNestedChange} placeholder="Team size, key roles, etc." className={inputClasses}/></div>
            <div><FormLabelWithTooltip htmlFor="systemMessiness" label="System Messiness (1-5)" tooltipText={tooltipTexts.systemMessiness} /><select id="systemMessiness" name="systemMessiness" value={buyBox.systemMessiness.value} onChange={handleNestedChange} className={inputClasses}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option></select></div>
        </div>
      </div>
      
      {/* --- Personal & Lifestyle --- */}
      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 mb-8">
        <h3 className="text-xl font-semibold text-slate-800 mb-6">Personal & Lifestyle</h3>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
            <div><FormLabelWithTooltip htmlFor="myPrimaryRole" label="My Primary Role" tooltipText={tooltipTexts.myPrimaryRole} /><select id="myPrimaryRole" name="myPrimaryRole" value={buyBox.myPrimaryRole.value} onChange={handleNestedChange} className={inputClasses}><option value="">Select your role</option><option value="any">Any / N/A</option><option value="dayToDay">Run Day-to-Day</option><option value="manager">Manage the Manager</option></select></div>
            <div><FormLabelWithTooltip htmlFor="geography" label="Geography" tooltipText={tooltipTexts.geography} /><input id="geography" type="text" name="geography" value={buyBox.geography.value} onChange={handleNestedChange} placeholder="Preferred location(s)" className={inputClasses} /></div>
            <div><FormLabelWithTooltip htmlFor="desiredCulture" label="Desired Culture" tooltipText={tooltipTexts.desiredCulture} /><input id="desiredCulture" type="text" name="desiredCulture" value={buyBox.desiredCulture} onChange={handleChange} placeholder="Company culture preferences" className={inputClasses}/></div>
            <div><FormLabelWithTooltip htmlFor="personalGoal" label="Personal Goal" tooltipText={tooltipTexts.personalGoal} /><input id="personalGoal" type="text" name="personalGoal" value={buyBox.personalGoal} onChange={handleChange} placeholder="Your acquisition goals" className={inputClasses}/></div>
        </div>
      </div>

      {/* --- Fit Analysis --- */}
      <div className="mt-8 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-slate-800">Buy Box Fit Analysis</h3>
            {fitAnalysis.overallFitScore !== null && (
                <div className="flex items-baseline">
                    <span className={`text-3xl font-bold ${getFitScoreColor(fitAnalysis.overallFitScore)}`}>{fitAnalysis.overallFitScore}%</span>
                    <span className="text-sm text-slate-500 ml-1">Overall Fit</span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button type="button" onClick={onClearFitAnalysis} disabled={!fitAnalysis.scorecardResult || state.isAnalyzingFit} className="w-full sm:w-auto px-6 py-3 font-medium text-slate-700 bg-white rounded-lg hover:bg-slate-100 border border-slate-300 disabled:opacity-50 transition">Clear Analysis</button>
            <button type="button" onClick={handleAnalyzeFitClick} disabled={!generalProfile || state.isAnalyzingFit} className="w-full sm:w-auto px-6 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-amber-500 transition duration-200 ease-in-out disabled:bg-slate-300 disabled:cursor-not-allowed">{state.isAnalyzingFit ? 'Analyzing...' : 'Analyze Fit'}</button>
          </div>
        </div>
         <p className="text-sm text-slate-500 mt-1">{generalProfile?.sourceUrl ? `Analyzing fit for: ${generalProfile.sourceUrl}` : "Generate a company profile first to enable analysis."}</p>
        {state.fitAnalysisError && <p className="text-red-500 text-sm mt-4">{state.fitAnalysisError}</p>}
        <div className="mt-6 bg-slate-50 p-6 rounded-lg border border-slate-200 min-h-[150px]">
          {state.isAnalyzingFit ? ( <div className="text-slate-500 text-center flex flex-col items-center justify-center h-full"><svg className="animate-spin h-6 w-6 text-amber-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p>Generating scorecard...</p></div>
          ) : fitAnalysis.scorecardResult ? (
            <>
              <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(fitAnalysis.scorecardResult)} />
              {fitAnalysis.fitAnalysisSources && fitAnalysis.fitAnalysisSources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200"><h4 className="text-md font-semibold text-slate-800 mb-3">Sources</h4><ul className="space-y-2 list-none p-0 m-0">{fitAnalysis.fitAnalysisSources.map((source, index) => (<li key={index} className="text-sm truncate"><a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700 hover:underline transition-colors" title={source.web.uri}>{source.web.title || source.web.uri}</a></li>))}</ul></div>
              )}
            </>
          ) : ( <div className="text-slate-500 text-center flex items-center justify-center h-full"><p>Your Buy Box Fit Scorecard will appear here.</p></div>
          )}
        </div>

        {fitAnalysis.scorecardResult && state.chatSession && (
          <div className="mt-6">
            <form onSubmit={handleFitFollowUpSubmit}>
              <label htmlFor="fitFollowUpInput" className="block text-sm font-medium text-slate-700 mb-2">Ask a follow-up on the Fit Analysis</label>
              <div className="flex items-center gap-3">
                <input
                  id="fitFollowUpInput"
                  type="text"
                  value={state.followUpInput}
                  onChange={(e) => setState({ ...state, followUpInput: e.target.value })}
                  placeholder="e.g., 'Explain the 'No' for Industry fit.'"
                  className={inputClasses}
                  disabled={state.isStreaming}
                />
                <button
                  type="submit"
                  className="px-8 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                  disabled={!state.followUpInput.trim() || state.isStreaming}
                >
                  {state.isStreaming ? '...' : 'Send'}
                </button>
              </div>
            </form>
             <div className="mt-4 flex flex-wrap items-center gap-2 px-1">
                <button
                    type="button"
                    onClick={handleAnalyzeFitMismatches}
                    className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-100 rounded-full hover:bg-amber-200 transition-colors"
                >
                    Analyze Fit Mismatches &rarr;
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyBox;