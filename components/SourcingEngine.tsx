import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BuyBoxCriteria, SavedProfile, Deal } from '../src/App';
import { getSourcingSearchPrompt, getSourcingAnalysisPrompt } from '../src/utils/prompts';
import { renderMarkdown } from '../src/utils/markdownRenderer';

interface SourcingEngineProps {
  buyBox: BuyBoxCriteria;
  onAddTask: (taskTitle: string, taskDescription: string, category: string, dealId?: string) => void;
  sourcingResultsGlobal: SourcingResult[];
  setSourcingResultsGlobal: React.Dispatch<React.SetStateAction<SourcingResult[]>>;
  onClear: () => void;
  isSourcingGlobal: boolean;
  setIsSourcingGlobal: React.Dispatch<React.SetStateAction<boolean>>;
  isAnalyzingGlobal: boolean;
  setIsAnalyzingGlobal: React.Dispatch<React.SetStateAction<boolean>>;
  sourcingProgressMessage: string;
  setSourcingProgressMessage: React.Dispatch<React.SetStateAction<string>>;
  savedProfiles: SavedProfile[];
  currentProfileName: string | null;
  onLoadProfile: (name: string) => void;
  deals: Deal[];
  onAddToPipeline: (sourcingResult: SourcingResult) => void;
  websiteList: string;
  setWebsiteList: React.Dispatch<React.SetStateAction<string>>;
}

interface FoundListing {
  url: string;
  title?: string;
}

export interface SourcingResult {
  url: string;
  title?: string;
  keyInsights: string;
  fullProfile: string;
  scorecard: string;
  overallFitScore: number | null;
  sde: number | null;
  industry: string | null;
  error?: string;
}

type SourcingMode = 'generateLinks' | 'findAndAnalyze';

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
    // non-weighted:
    'Industry Expertise': 'industryExpertise',
    'Culture': null,
};

const calculateOverallFitScore = (scorecard: string, buyBox: BuyBoxCriteria): number | null => {
    if (!scorecard) return null;

    let achievedScore = 0;
    let totalPossibleScore = 0;

    // Robustly calculate total possible score by iterating through the buy box criteria object
    for (const key in buyBox) {
        const criteria = buyBox[key as keyof BuyBoxCriteria];
        if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria) && 'weight' in criteria && typeof criteria.weight === 'number') {
            totalPossibleScore += criteria.weight;
        }
    }

    // Handle case where SDE min and max weights are separate but should be counted as one
    if (buyBox.minSde.weight > 0 && buyBox.maxSde.weight > 0) {
        totalPossibleScore -= buyBox.maxSde.weight; // Don't double-count SDE
    }

    if (totalPossibleScore === 0) return 50; // Default if no weights set

    const rows = scorecard.split('\n').slice(2);
    rows.forEach(row => {
        const columns = row.split('|').map(c => c.trim());
        if (columns.length >= 4) {
            const criteriaNameWithWeight = columns[1];
            // FIX: Strip the weight part from the criteria name to match the map key
            const criteriaName = criteriaNameWithWeight.split(' (Weight:')[0].trim();
            
            const fit = columns[3].toLowerCase();
            const buyBoxKey = criteriaNameToKeyMap[criteriaName];

            if (buyBoxKey) {
                const criteria = buyBox[buyBoxKey as keyof BuyBoxCriteria];
                 if (typeof criteria === 'object' && criteria !== null && !Array.isArray(criteria) && 'weight' in criteria && typeof criteria.weight === 'number') {
                    const weight = criteria.weight;
                    if (fit === 'yes') {
                        achievedScore += weight;
                    } else if (fit === '?') {
                        achievedScore += weight * 0.3; // Partial credit for unknowns
                    }
                }
            }
        }
    });
    
    return Math.round((achievedScore / totalPossibleScore) * 100);
};

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

const SourcingEngine: React.FC<SourcingEngineProps> = ({ buyBox, onAddTask, sourcingResultsGlobal, setSourcingResultsGlobal, onClear, isSourcingGlobal, setIsSourcingGlobal, isAnalyzingGlobal, setIsAnalyzingGlobal, sourcingProgressMessage, setSourcingProgressMessage, savedProfiles, currentProfileName, onLoadProfile, deals, onAddToPipeline, websiteList, setWebsiteList }) => {
  const [error, setError] = useState('');
  const [activeResult, setActiveResult] = useState<SourcingResult | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  
  const [sourcingMode, setSourcingMode] = useState<SourcingMode>('findAndAnalyze');
  const [isGeneratingLinks, setIsGeneratingLinks] = useState<boolean>(false);

  // --- Refined Search & Filter State ---
  const [searchIndustries, setSearchIndustries] = useState('');
  const [searchGeographies, setSearchGeographies] = useState('');
  const [filterScoreMin, setFilterScoreMin] = useState(0);
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterSdeMin, setFilterSdeMin] = useState('');
  const [filterSdeMax, setFilterSdeMax] = useState('');

  useEffect(() => {
    if (buyBox) {
        setSearchIndustries(buyBox.industryType.value);
        setSearchGeographies(buyBox.geography.value);
    }
  }, [buyBox]);
  
  const handleAnalyzeLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidUrl(manualUrl)) {
        setError("Please enter a valid URL starting with http:// or https://.");
        return;
    }
    setError('');
    
    const listingToAnalyze: FoundListing = {
        url: manualUrl,
        title: `Manually Added: ${new URL(manualUrl).hostname}`
    };

    try {
        await analyzeListings([listingToAnalyze]);
        setManualUrl(''); // Clear input on success
    } catch (err: any) {
        setError(err.message || 'Failed to analyze the provided link.');
    }
  };
  
  const handleUpdateLinks = async () => {
    setIsGeneratingLinks(true);
    setError('');
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const linkGenPrompt = `
You are an M&A sourcing analyst. Your task is to provide a comprehensive list of websites where a user can search for businesses for sale.

**Your Task:**
*   Generate a Markdown list of top online marketplaces and broker networks for buying and selling businesses.
*   For each website, provide the name, the direct URL to the homepage or main search page, and a brief, one-sentence description of what it's best for (e.g., tech startups, main street businesses, etc.).
*   Format each list item as follows: \`* **[Website Name]:** \`[URL]\` - [Description]\`

**Example Response Format:**
*   **BizBuySell.com:** \`https://www.bizbuysell.com/\` - The largest online marketplace for main street businesses and franchises in the US.
*   **Acquire.com:** \`https://acquire.com/\` - A leading marketplace for buying and selling SaaS and other tech startups.
*   **EmpireFlippers.com:** \`https://empireflippers.com/\` - A curated marketplace for established, profitable online businesses like e-commerce and content sites.
`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: linkGenPrompt,
            config: {
                tools: [{googleSearch: {}}]
            }
        });

        setWebsiteList(response.text);

    } catch (e: any) {
        console.error("Error generating search links:", e);
        setError(e.message || 'Failed to generate links.');
    } finally {
        setIsGeneratingLinks(false);
    }
  };

  const renderLinksMarkdown = (text: string) => {
    const listItems = text.split('\n').filter(line => line.trim().startsWith('*'));

    const html = listItems.map((item, index) => {
        // Match: * **Website Name:** `URL` - Description
        const match = item.match(/\*\s*\*\*(.*?):\*\*\s*`?(.*?)`?\s*-\s*(.*)/);

        if (match) {
            const [, website, url, description] = match;
            return `
                <li key=${index} class="mb-4 p-4 bg-slate-100 rounded-lg border border-slate-200">
                    <strong class="text-slate-800 block text-lg">${website.trim()}</strong>
                    <a href="${url.trim()}" target="_blank" rel="noopener noreferrer" class="text-amber-600 hover:underline break-all text-sm">${url.trim()}</a>
                    <p class="text-slate-600 mt-2 text-sm">${description.trim()}</p>
                </li>
            `;
        }
        return `<li key=${index} class="text-slate-600">${item}</li>`; // Fallback for any non-matching lines
    }).join('');

    return { __html: `<ul class="list-none p-0 space-y-4">${html}</ul>` };
  };

  const handleFindDeals = async () => {
    setIsSourcingGlobal(true);
    setIsAnalyzingGlobal(false);
    setError('');
    setSourcingResultsGlobal([]);
    setSourcingProgressMessage('Step 1/2: Finding Listings...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = getSourcingSearchPrompt(searchIndustries, searchGeographies, buyBox);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: { 
          tools: [{googleSearch: {}}]
        }
      });
      
      let listingsJson = response.text.trim();

      const jsonMatch = listingsJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        listingsJson = jsonMatch[1];
      }
      
      let listings: FoundListing[];
      try {
          listings = JSON.parse(listingsJson) as FoundListing[];
      } catch (parseError) {
        console.error("Failed to parse listings JSON:", parseError, "Raw JSON string:", listingsJson);
        throw new Error("AI returned an invalid list format. Please try again.");
      }

      if (!listings || listings.length === 0) {
        setSourcingProgressMessage('No new listings found matching your criteria.');
        setIsSourcingGlobal(false);
        return;
      }
      
      setIsSourcingGlobal(false);
      await analyzeListings(listings);

    } catch (e: any) {
      console.error("Error finding deals:", e);
      setError(e.message || 'Failed to find listings. The AI may be unable to parse marketplaces right now.');
      setIsSourcingGlobal(false);
    }
  };

  const analyzeListings = async (listings: FoundListing[]) => {
    setIsAnalyzingGlobal(true);
    
    for (const [index, listing] of listings.entries()) {
      setSourcingProgressMessage(`Step 2/2: Analyzing listing ${index + 1}/${listings.length}: ${listing.title || listing.url}`);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = getSourcingAnalysisPrompt(listing.url, buyBox);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 32768 } },
        });
        const text = response.text;
        const parts = text.split('---[SPLIT]---');
        
        if (parts.length < 3) throw new Error("Analysis response missing required parts.");
        
        const [keyInsights, fullProfile, scorecard] = parts.map(p => p.trim());
        const overallFitScore = calculateOverallFitScore(scorecard, buyBox);
        
        const sdeMatch = fullProfile.match(/Reported SDE\/Cash Flow:\s*\$?([\d,]+)/i);
        const sde = sdeMatch ? parseInt(sdeMatch[1].replace(/,/g, ''), 10) : null;
        const industryMatch = fullProfile.match(/Primary Industry:\s*(.*)/i);
        const industry = industryMatch ? industryMatch[1].trim() : null;

        const newResult: SourcingResult = { ...listing, keyInsights, fullProfile, scorecard, overallFitScore, sde, industry };
        setSourcingResultsGlobal(prev => [newResult, ...prev]);

      } catch (e) {
        console.error(`Error analyzing ${listing.url}:`, e);
        const errorResult: SourcingResult = { ...listing, keyInsights: '', fullProfile: '', scorecard: '', overallFitScore: null, sde: null, industry: null, error: `Failed to analyze this listing.` };
        setSourcingResultsGlobal(prev => [errorResult, ...prev]);
        throw e;
      }
    }

    setIsAnalyzingGlobal(false);
    setSourcingProgressMessage(`Analysis complete. Found and analyzed ${listings.length} listings.`);
  };
  
  const handleMainAction = () => {
    if (sourcingMode === 'generateLinks') {
        handleUpdateLinks();
    } else {
        handleFindDeals();
    }
  };

  const isDealInPipeline = (url: string) => deals.some(d => d.sourcingResult.url === url);

  const applyFilters = (results: SourcingResult[]) => {
    const minSde = filterSdeMin ? parseInt(filterSdeMin.replace(/,/g, ''), 10) : 0;
    const maxSde = filterSdeMax ? parseInt(filterSdeMax.replace(/,/g, ''), 10) : Infinity;

    return results.filter(result => {
        if (result.error) return true;
        const scoreMatch = (result.overallFitScore || 0) >= filterScoreMin;
        const industryMatch = !filterIndustry || (result.industry && result.industry.toLowerCase().includes(filterIndustry.toLowerCase()));
        const sdeMatch = !result.sde || (result.sde >= minSde && result.sde <= maxSde);
        return scoreMatch && industryMatch && sdeMatch;
    });
  }

  const filteredResults = useMemo(() => applyFilters(sourcingResultsGlobal), [sourcingResultsGlobal, filterScoreMin, filterIndustry, filterSdeMin, filterSdeMax]);
  
  const isLoading = isSourcingGlobal || isAnalyzingGlobal || isGeneratingLinks;
  
  const mainButtonText = sourcingMode === 'generateLinks'
    ? (websiteList ? 'Update Website List' : 'Generate Website List')
    : 'Find Deals';

  return (
    <div className="bg-white p-8 rounded-lg shadow-sm w-full max-w-7xl mx-auto border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4 border-b border-slate-200 pb-6">
            <div>
                <h2 className="text-2xl font-semibold text-slate-800">Deal Sourcing Engine</h2>
                <p className="text-base text-slate-500 mt-1">Automatically find and analyze deals that fit your Buy Box.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <button onClick={() => { onClear(); }} disabled={isLoading || sourcingResultsGlobal.length === 0} className="w-full sm:w-auto px-6 py-3 font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition">Clear Results</button>
            </div>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <label htmlFor="manualUrl" className="block text-base font-semibold text-slate-800 mb-2">Analyze a Specific Listing</label>
            <form onSubmit={handleAnalyzeLink} className="flex flex-col sm:flex-row items-center gap-3">
                <input
                    id="manualUrl"
                    type="text"
                    value={manualUrl}
                    onChange={e => setManualUrl(e.target.value)}
                    placeholder="Paste a business listing URL here..."
                    className="flex-grow w-full px-4 py-3 text-base text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition disabled:opacity-70"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
                    disabled={isLoading || !manualUrl.trim()}
                >
                    Analyze Link
                </button>
            </form>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 mb-6">
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800">Automated Sourcing</h3>
                <div className="flex items-center gap-2 bg-slate-200 rounded-md p-1 self-start mb-2">
                    <button onClick={() => setSourcingMode('generateLinks')} className={`px-3 py-1 text-sm rounded ${sourcingMode === 'generateLinks' ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm' : 'text-slate-600'}`}>Generate Website List</button>
                    <button onClick={() => setSourcingMode('findAndAnalyze')} className={`px-3 py-1 text-sm rounded ${sourcingMode === 'findAndAnalyze' ? 'bg-amber-500 text-slate-900 font-semibold shadow-sm' : 'text-slate-600'}`}>Find & Analyze Deals</button>
                </div>

                {sourcingMode === 'findAndAnalyze' ? (
                    <>
                        <div>
                            <label className="text-sm font-medium text-slate-500 mb-1.5 block">1. Load Buy Box Profile</label>
                            <select value={currentProfileName || ''} onChange={(e) => onLoadProfile(e.target.value)} className="w-full bg-white text-slate-800 border border-slate-300 rounded-md py-2.5 px-3 text-sm">
                                {savedProfiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="searchIndustries" className="text-sm font-medium text-slate-500 mb-1.5 block">2. Refine Search Scope (Optional)</label>
                            <input id="searchIndustries" type="text" value={searchIndustries} onChange={e => setSearchIndustries(e.target.value)} placeholder="Industries (comma-separated)..." className="w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm mb-2" />
                            <input type="text" value={searchGeographies} onChange={e => setSearchGeographies(e.target.value)} placeholder="Geographies (comma-separated)..." className="w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm" />
                        </div>
                    </>
                ) : (
                    <div className="text-sm text-slate-500 bg-slate-100 p-3 rounded-md">
                        <p>Click the button below to generate a list of websites for finding businesses for sale. This list will be saved for future sessions.</p>
                    </div>
                )}

                <button 
                    onClick={handleMainAction} 
                    disabled={isLoading || (sourcingMode === 'findAndAnalyze' && (!searchIndustries || !searchGeographies))} 
                    className="w-full px-6 py-3 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
                >
                    {mainButtonText}
                </button>
            </div>
            <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800">Filter Results</h3>
                 <div>
                    <label htmlFor="filterScore" className="text-sm font-medium text-slate-500 mb-1.5 flex justify-between"><span>Min. Fit Score</span> <span>{filterScoreMin}%</span></label>
                    <input id="filterScore" type="range" min="0" max="100" value={filterScoreMin} onChange={e => setFilterScoreMin(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)} placeholder="Filter by Industry..." className="sm:col-span-1 w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm" />
                    <input type="text" value={filterSdeMin} onChange={e => setFilterSdeMin(e.target.value)} placeholder="Min SDE" className="sm:col-span-1 w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm" />
                    <input type="text" value={filterSdeMax} onChange={e => setFilterSdeMax(e.target.value)} placeholder="Max SDE" className="sm:col-span-1 w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm" />
                </div>
            </div>
        </div>

      {error && <p className="text-red-500 text-center my-6">{error}</p>}
      
      {sourcingMode === 'generateLinks' ? (
        <>
          {isGeneratingLinks && (
            <div className="text-center bg-slate-100 border border-slate-200 rounded-lg p-4 my-6">
              <p className="text-amber-600 font-medium">Generating website list...</p>
            </div>
          )}
          {websiteList && !isGeneratingLinks && (
            <div className="my-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Sourcing Websites</h3>
              <div dangerouslySetInnerHTML={renderLinksMarkdown(websiteList)} />
            </div>
          )}
          {!websiteList && !isGeneratingLinks && (
             <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-300 rounded-lg my-6">
               <p>Click "Generate Website List" to get started.</p>
             </div>
          )}
        </>
      ) : (
        <>
          {(isSourcingGlobal || isAnalyzingGlobal) && !error && (
            <div className="text-center bg-slate-100 border border-slate-200 rounded-lg p-4 my-6">
              <p className="text-amber-600 font-medium">{sourcingProgressMessage}</p>
              {(isSourcingGlobal || isAnalyzingGlobal) && <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2"><div className="bg-amber-500 h-2.5 rounded-full animate-pulse" style={{ width: '100%' }}></div></div>}
            </div>
          )}

          <div className="border-b border-slate-200 mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Search Results ({filteredResults.length})</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResults.map((result, index) => (
              <div key={index} className="flex flex-col bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-grow">
                        <h3 className="font-bold text-slate-800">{result.title || new URL(result.url).hostname}</h3>
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 hover:underline break-all">{result.url}</a>
                    </div>
                    <button
                        onClick={() => onAddToPipeline(result)}
                        disabled={isDealInPipeline(result.url)}
                        className="flex-shrink-0 p-2 rounded-full text-amber-500 hover:bg-slate-100 transition-colors disabled:text-slate-400 disabled:cursor-not-allowed"
                        title={isDealInPipeline(result.url) ? "Deal is in Pipeline" : "Add to Pipeline"}
                    >
                      {isDealInPipeline(result.url) ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                      )}
                    </button>
                </div>
                {result.error ? (
                  <div className="flex-grow flex items-center justify-center text-center text-red-600 text-sm my-4 bg-red-50 p-3 rounded-md">{result.error}</div>
                ) : (
                  <>
                    <div className="my-4">
                      <span className="text-xs text-slate-500">Overall Fit Score</span>
                      <p className={`text-4xl font-bold ${result.overallFitScore && result.overallFitScore >= 75 ? 'text-green-600' : result.overallFitScore && result.overallFitScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {result.overallFitScore !== null ? `${result.overallFitScore}%` : 'N/A'}
                      </p>
                    </div>
                     <div className="text-xs text-slate-500 mb-3 space-y-1">
                        {result.industry && <p><strong>Industry:</strong> {result.industry}</p>}
                        {result.sde && <p><strong>SDE:</strong> ${result.sde.toLocaleString()}</p>}
                     </div>
                    <div className="flex-grow text-sm text-slate-600 space-y-2 mb-4" dangerouslySetInnerHTML={renderMarkdown(result.keyInsights.substring(0, 150) + '...')} />
                  </>
                )}

                <div className="flex flex-col sm:flex-row gap-2 mt-auto pt-4 border-t border-slate-200">
                    <button onClick={() => setActiveResult(result)} disabled={!!result.error} className="w-full px-4 py-2 text-sm font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition">View Full Analysis</button>
                    <button onClick={() => onAddTask(`Follow up on: ${result.title}`, `Initial analysis complete.\nFit Score: ${result.overallFitScore}%\nURL: ${result.url}`, 'Sourcing')} disabled={!!result.error} className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition">Add to Tasks</button>
                </div>
              </div>
            ))}
          </div>

          {sourcingResultsGlobal.length === 0 && !isLoading && !error && (
            <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-300 rounded-lg">
              <p>
                Configure your search criteria and click "Find Deals" to start.
              </p>
            </div>
          )}
        </>
      )}

      {activeResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setActiveResult(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl p-8 w-full max-w-4xl h-[90vh] shadow-lg flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 mb-4">
              <h3 className="text-xl font-bold text-slate-800">{activeResult.title}</h3>
              <a href={activeResult.url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-600 hover:underline">{activeResult.url}</a>
            </div>
            <div className="flex-grow overflow-y-auto pr-4 space-y-6">
              <div>
                <h4 className="font-semibold text-amber-600 mb-2 border-b border-slate-200 pb-1">Key Insights & Red Flags</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(activeResult.keyInsights)} />
              </div>
              <div>
                <h4 className="font-semibold text-amber-600 mb-2 border-b border-slate-200 pb-1">Detailed Company Profile</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(activeResult.fullProfile)} />
              </div>
              <div>
                <h4 className="font-semibold text-amber-600 mb-2 border-b border-slate-200 pb-1">Buy Box Fit Scorecard ({activeResult.overallFitScore}%)</h4>
                <div className="text-slate-700" dangerouslySetInnerHTML={renderMarkdown(activeResult.scorecard)} />
              </div>
            </div>
            <div className="flex-shrink-0 pt-6 border-t border-slate-200 text-right">
              <button onClick={() => setActiveResult(null)} className="px-6 py-2.5 font-semibold text-gray-900 bg-amber-500 rounded-lg hover:bg-amber-600 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourcingEngine;