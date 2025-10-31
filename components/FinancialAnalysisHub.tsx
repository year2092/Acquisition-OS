// User TODO: Install papaparse for CSV export: npm install papaparse @types/papaparse
import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { GoogleGenAI, Type } from "@google/genai";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area, ComposedChart,
} from 'recharts';

// --- Interfaces --- //

export interface FinancialPeriod {
  id: string;
  periodName: string; // e.g., "2023", "2022", "TTM"
  // Income Statement
  revenue: string;
  cogs: string; // Cost of Goods Sold
  operatingExpenses: string; // SG&A
  depreciation: string;
  amortization: string;
  interestExpense: string;
  taxes: string;
  // Balance Sheet
  cash: string;
  accountsReceivable: string;
  inventory: string;
  otherCurrentAssets: string;
  longTermAssets: string;
  accountsPayable: string;
  shortTermDebt: string;
  otherCurrentLiabilities: string;
  longTermDebt: string;
  shareholderEquity: string;
}

export interface AddBack {
  id: string;
  description: string;
  amount: string;
  category: 'Owner Discretionary Expenses' | 'Non-recurring Expenses' | 'Non-operational Expenses' | 'Add-backs for Standardization' | 'Personal' | 'One-Time' | 'Other';
}

export interface FinancialAnalysisData {
  companyName: string;
  periods: FinancialPeriod[];
  addBacks: AddBack[];
  ytdMonths: string;
  ytdActuals: FinancialPeriod;
  ownerCompAddBack: string;
  financialNotes: string;
  addBackNotes: string;
}

interface FinancialAnalysisHubProps {
  data: FinancialAnalysisData | null;
  setData: React.Dispatch<React.SetStateAction<FinancialAnalysisData | null>>;
  onClear: () => void;
}

interface FinancialErrors {
    [periodId: string]: {
        [metric: string]: string | null;
    };
}

interface BenchmarkRatios {
    grossMarginPercent: string;
    ebitdaMarginPercent: string;
    currentRatio: string;
    dso: string;
dpo: string;
}

// --- Helper Functions & Constants --- //

const FINANCIAL_ANALYSIS_STORAGE_KEY = 'financialAnalysisHubData';

const ADD_BACK_CATEGORIES: AddBack['category'][] = [
    "Owner Discretionary Expenses",
    "Non-recurring Expenses",
    "Non-operational Expenses",
    "Add-backs for Standardization",
    "Personal",
    "One-Time",
    "Other"
];


const createNewPeriod = (name: string = new Date().getFullYear().toString()): FinancialPeriod => ({
  id: crypto.randomUUID(),
  periodName: name,
  revenue: '', cogs: '', operatingExpenses: '', depreciation: '',
  amortization: '', interestExpense: '', taxes: '', cash: '',
  accountsReceivable: '', inventory: '', otherCurrentAssets: '',
  longTermAssets: '', accountsPayable: '', shortTermDebt: '',
  otherCurrentLiabilities: '', longTermDebt: '', shareholderEquity: '',
});

const defaultFinancialData: FinancialAnalysisData = {
  companyName: 'Example B2B Services Co.',
  periods: [
    { // 2023
      id: crypto.randomUUID(),
      periodName: (new Date().getFullYear() - 1).toString(),
      revenue: '2500000',
      cogs: '1500000',
      operatingExpenses: '600000',
      depreciation: '55000',
      amortization: '10000',
      interestExpense: '35000',
      taxes: '75000',
      cash: '200000',
      accountsReceivable: '300000',
      inventory: '120000',
      otherCurrentAssets: '25000',
      longTermAssets: '450000',
      accountsPayable: '140000',
      shortTermDebt: '40000',
      otherCurrentLiabilities: '35000',
      longTermDebt: '250000',
      shareholderEquity: '630000',
    },
    { // 2022
      id: crypto.randomUUID(),
      periodName: (new Date().getFullYear() - 2).toString(),
      revenue: '2200000',
      cogs: '1320000',
      operatingExpenses: '550000',
      depreciation: '50000',
      amortization: '10000',
      interestExpense: '40000',
      taxes: '60000',
      cash: '150000',
      accountsReceivable: '250000',
      inventory: '100000',
      otherCurrentAssets: '20000',
      longTermAssets: '400000',
      accountsPayable: '120000',
      shortTermDebt: '50000',
      otherCurrentLiabilities: '30000',
      longTermDebt: '300000',
      shareholderEquity: '420000',
    },
  ],
  addBacks: [
      { id: crypto.randomUUID(), description: 'Owner\'s Personal Auto Expense', amount: '15000', category: 'Owner Discretionary Expenses' },
      { id: crypto.randomUUID(), description: 'One-Time Legal Fee for Lawsuit', amount: '25000', category: 'Non-recurring Expenses' }
  ],
  ytdMonths: '9',
  ytdActuals: {
    id: crypto.randomUUID(),
    periodName: 'YTD Actuals',
    revenue: '2100000',
    cogs: '1260000',
    operatingExpenses: '525000',
    depreciation: '45000',
    amortization: '7500',
    interestExpense: '25000',
    taxes: '60000',
    cash: '250000',
    accountsReceivable: '350000',
    inventory: '140000',
    otherCurrentAssets: '30000',
    longTermAssets: '480000',
    accountsPayable: '160000',
    shortTermDebt: '30000',
    otherCurrentLiabilities: '40000',
    longTermDebt: '220000',
    shareholderEquity: '800000',
  },
  ownerCompAddBack: '120000',
  financialNotes: 'This is an example for a B2B services business. Note the strong revenue growth and stable gross margins. Working capital needs appear to be growing with revenue.',
  addBackNotes: 'Owner compensation is set to a market rate for a general manager. Other add-backs are for clear, non-recurring personal or one-time business expenses.',
};


const parseNum = (val: string | number) => parseFloat(String(val).replace(/,/g, '')) || 0;
const formatCurrency = (val: number, compact = false) => {
    if (isNaN(val)) return compact ? 'N/A' : '$0';
    if (compact) {
        if (Math.abs(val) >= 1e6) return `${(val/1e6).toFixed(1)}M`;
        if (Math.abs(val) >= 1e3) return `${(val/1e3).toFixed(0)}k`;
        return val.toFixed(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}
const formatPercent = (val: number) => isNaN(val) || !isFinite(val) ? '0.0%' : `${(val * 100).toFixed(1)}%`;
const formatRatio = (val: number) => isNaN(val) || !isFinite(val) ? '0.0x' : `${val.toFixed(1)}x`;
const formatDays = (val: number) => isNaN(val) || !isFinite(val) ? '0' : val.toFixed(0);

const formatNumber = (val: string | number) => {
    if (val === '' || val === null || val === undefined) return '';
    if (String(val).trim() === '.' || String(val).endsWith('.')) return String(val);
    const num = parseNum(val);
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat('en-US').format(num);
};

const inputClasses = "w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm text-right transition focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400";
const inputErrorClasses = "border-red-500 ring-1 ring-red-500/50";
const errorMessageClasses = "text-red-400 text-xs text-right mt-1 px-1";
const thClasses = "sticky top-0 bg-slate-100/80 backdrop-blur-sm p-2 text-xs text-slate-500 font-medium text-right whitespace-nowrap";
const tdClasses = "p-1";
const labelClasses = "p-2 text-sm text-slate-500 text-left font-medium sticky left-0 bg-white whitespace-nowrap z-10";

// --- New, smarter mapping for CSV import ---
const metricAliasMap: { [key in keyof Omit<FinancialPeriod, 'id' | 'periodName'>]?: string[] } = {
    revenue: ['Revenue', 'Sales', 'Total Revenue', 'Turnover'],
    cogs: ['COGS', 'Cost of Goods Sold', 'Cost of Sales', 'Cost of Revenue'],
    operatingExpenses: ['OpEx', 'Operating Expenses', 'SG&A', 'Selling, General & Administrative', 'SGA'],
    depreciation: ['Depreciation'],
    amortization: ['Amortization', 'Amortisation'],
    interestExpense: ['Interest', 'Interest Expense', 'Finance Costs'],
    taxes: ['Taxes', 'Income Tax Expense', 'Provision for Income Taxes'],
    cash: ['Cash', 'Cash and Cash Equivalents'],
    accountsReceivable: ['A/R', 'Accounts Receivable', 'Receivables', 'Trade Debtors'],
    inventory: ['Inventory', 'Stock', 'Inventories'],
    otherCurrentAssets: ['Other Current Assets'],
    longTermAssets: ['Long-Term Assets', 'Fixed Assets', 'Non-Current Assets', 'PP&E', 'Property, Plant, and Equipment'],
    accountsPayable: ['A/P', 'Accounts Payable', 'Payables', 'Trade Creditors'],
    shortTermDebt: ['Short-Term Debt', 'Current Portion of Debt', 'Current Debt'],
    otherCurrentLiabilities: ['Other Current Liabilities', 'Accrued Expenses', 'Accrued Liabilities', 'Other Current Liab.'],
    longTermDebt: ['Long-Term Debt', 'Non-Current Liabilities', 'Debt'],
    shareholderEquity: ['Equity', 'Shareholder Equity', 'Stockholder Equity', 'Total Equity', 'Shareholders Equity'],
};

const invertedAliasMap: { [alias: string]: keyof FinancialPeriod } = {};
for (const key in metricAliasMap) {
    const typedKey = key as keyof typeof metricAliasMap;
    const aliases = metricAliasMap[typedKey];
    if (aliases) {
        aliases.forEach(alias => {
            invertedAliasMap[alias.trim().toLowerCase()] = typedKey;
        });
    }
}


// --- Main Component --- //

const FinancialAnalysisHub: React.FC<FinancialAnalysisHubProps> = ({ data: propData, setData, onClear }) => {
  const data = propData ?? defaultFinancialData;
  const [commonSizeBase, setCommonSizeBase] = useState<'none' | 'revenue' | 'assets'>('none');
  const [inputErrors, setInputErrors] = useState<FinancialErrors>({});
  const [benchmarks, setBenchmarks] = useState<BenchmarkRatios>({
    grossMarginPercent: '45',
    ebitdaMarginPercent: '15',
    currentRatio: '1.5',
    dso: '45',
dpo: '30',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  // --- Data Persistence ---
  const handleSaveData = () => {
    try {
        const stateToSave = {
            financials: data,
            benchmarks: benchmarks
        };
        localStorage.setItem(FINANCIAL_ANALYSIS_STORAGE_KEY, JSON.stringify(stateToSave));
        showToast("Financial data saved successfully!");
    } catch (error) {
        console.error("Failed to save data:", error);
        showToast("Error: Could not save data.");
    }
  };

  const handleLoadData = () => {
    try {
        const savedState = localStorage.getItem(FINANCIAL_ANALYSIS_STORAGE_KEY);
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            setData(parsedState.financials || defaultFinancialData);
            setBenchmarks(parsedState.benchmarks || { grossMarginPercent: '45', ebitdaMarginPercent: '15', currentRatio: '1.5', dso: '45', dpo: '30' });
            showToast("Successfully loaded last saved data.");
        } else {
            showToast("No saved data found.");
        }
    } catch (error) {
        console.error("Failed to load data:", error);
        showToast("Error: Could not load data.");
    }
  };

  useEffect(() => {
    // Auto-load on initial mount
    const savedState = localStorage.getItem(FINANCIAL_ANALYSIS_STORAGE_KEY);
    if(savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            if (parsedState.financials) setData(parsedState.financials);
            if (parsedState.benchmarks) setBenchmarks(parsedState.benchmarks);
        } catch (e) { console.error("Could not parse saved financial data", e)}
    }
  }, []); // Empty array ensures this runs only once on mount

  const handleDataChange = <K extends keyof FinancialAnalysisData>(field: K, value: FinancialAnalysisData[K]) => {
    setData({ ...data, [field]: value });
  };

  const handlePeriodChange = (periodId: string, field: keyof FinancialPeriod, value: string) => {
      const isYtd = periodId === data.ytdActuals.id;
      const targetPeriod = isYtd ? data.ytdActuals : data.periods.find(p => p.id === periodId);
      if (!targetPeriod) return;

      const cleanedValue = value.replace(/,/g, '');
      if (cleanedValue === '' || !isNaN(parseFloat(cleanedValue))) {
          const updatedPeriod = { ...targetPeriod, [field]: cleanedValue };
          if (isYtd) {
              handleDataChange('ytdActuals', updatedPeriod);
          } else {
              handleDataChange('periods', data.periods.map(p => p.id === periodId ? updatedPeriod : p));
          }
          setInputErrors(prev => ({ ...prev, [periodId]: { ...prev[periodId], [field]: null } }));
      } else {
          setInputErrors(prev => ({ ...prev, [periodId]: { ...prev[periodId], [field]: "Invalid number" } }));
      }
  };
  
    const handleAddBackChange = (backId: string, field: keyof AddBack, value: string) => {
        let processedValue = value;
        if (field === 'amount') {
            processedValue = value.replace(/,/g, '');
        }
        const updatedBacks = data.addBacks.map(b => b.id === backId ? {...b, [field]: processedValue} : b);
        handleDataChange('addBacks', updatedBacks);
    }

  const handleBenchmarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const {name, value} = e.target;
      setBenchmarks(prev => ({...prev, [name]: value}));
  }

  const handleAddPeriod = () => {
    const latestYear = data.periods.reduce((max, p) => Math.max(max, parseInt(p.periodName) || 0), 0);
    const newPeriod = createNewPeriod((latestYear > 0 ? latestYear + 1 : new Date().getFullYear()).toString());
    handleDataChange('periods', [newPeriod, ...data.periods]);
  };

  const handleRemovePeriod = (periodId: string) => {
    if (data.periods.length <= 1) return;
    handleDataChange('periods', data.periods.filter(p => p.id !== periodId));
  };
  
  const handleAddBack = () => {
      const newBack: AddBack = { id: crypto.randomUUID(), description: '', amount: '', category: 'Other'};
      handleDataChange('addBacks', [...data.addBacks, newBack]);
  }
  
  const handleRemoveAddBack = (backId: string) => {
      handleDataChange('addBacks', data.addBacks.filter(b => b.id !== backId));
  }
  
    const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const parsedData = results.data as { [key: string]: string }[];
                    if (parsedData.length === 0) {
                        showToast('Warning: CSV file is empty or invalid.');
                        return;
                    }

                    const headers = results.meta.fields || [];
                    const metricHeader = headers[0];
                    if (!metricHeader) {
                        showToast('Error: CSV must have a header row.');
                        return;
                    }
                    const periodNames = headers.slice(1);

                    const newPeriodsData: { [key: string]: Partial<FinancialPeriod> } = {};

                    periodNames.forEach(name => {
                        newPeriodsData[name] = { id: crypto.randomUUID(), periodName: name };
                    });

                    parsedData.forEach(row => {
                        const metricName = row[metricHeader];
                        if (!metricName) return; // Skip rows without a metric name

                        const normalizedMetricName = metricName.trim().toLowerCase();
                        const stateKey = invertedAliasMap[normalizedMetricName];
                        
                        if (stateKey) {
                            periodNames.forEach(periodName => {
                                if (row[periodName] !== undefined && row[periodName] !== null) {
                                    (newPeriodsData[periodName] as any)[stateKey] = row[periodName];
                                }
                            });
                        }
                    });
                    
                    let newYtdActuals = data.ytdActuals; 
                    const newPeriods: FinancialPeriod[] = [];

                    Object.values(newPeriodsData).forEach(periodObject => {
                        const periodNameLower = periodObject.periodName?.toLowerCase() || '';
                        if (periodNameLower.includes('ytd') || periodNameLower.includes('ttm')) { 
                            newYtdActuals = { ...createNewPeriod(periodObject.periodName), ...periodObject } as FinancialPeriod;
                        } else {
                            newPeriods.push({ ...createNewPeriod(periodObject.periodName), ...periodObject } as FinancialPeriod);
                        }
                    });

                    setData(prev => ({
                        ...(prev ?? defaultFinancialData),
                        periods: newPeriods,
                        ytdActuals: newYtdActuals,
                    }));

                    showToast('CSV data imported successfully!');
                } catch (error) {
                    console.error("Error processing CSV data:", error);
                    showToast('Error: Failed to process CSV file. Check format.');
                }
            },
            error: (error: any) => {
                console.error("Error parsing CSV:", error);
                showToast(`Error: ${error.message}`);
            }
        });

        event.target.value = ''; // Allow re-uploading the same file
    };


  const handleExportCSV = () => {
    const periodsToExport = calculationResults.calculations;
    if (periodsToExport.length === 0) {
        alert("No data to export.");
        return;
    }
    const headers = ["Metric", ...periodsToExport.map(p => p.periodName)];
    const dataRows = [
        { Metric: 'Revenue', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.revenue])) },
        { Metric: 'Gross Profit', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.grossProfit])) },
        { Metric: 'EBITDA', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.ebitda])) },
        { Metric: 'Normalized EBITDA', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.normalizedEbitda])) },
        { Metric: 'Normalized SDE', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.normalizedSde])) },
        { Metric: 'Net Income', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.netIncome])) },
        { Metric: 'Net Working Capital', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.netWorkingCapital])) },
        { Metric: 'DSO (Days)', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.dso])) },
        { Metric: 'DPO (Days)', ...Object.fromEntries(periodsToExport.map(p => [p.periodName, p.dpo])) },
    ];
    const csv = Papa.unparse({
        fields: headers,
        data: dataRows.map(row => headers.map(h => row[h as keyof typeof row]))
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${data.companyName || 'financial'}_analysis.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]); // remove the data URI prefix
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        setIsScanning(true);
        showToast(`Scanning ${file.name}...`);
    
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const base64Data = await fileToBase64(file);
    
            const filePart = {
                inlineData: { data: base64Data, mimeType: file.type },
            };
            
            const aiScanPrompt = `You are an expert financial analyst specializing in OCR and data extraction from M&A documents. Your Task: Analyze the provided image or PDF of a financial statement (likely an Income Statement or P&L). Extract the financial data for each available period (e.g., 2023, 2024, 2025, YTD). Return ONLY a single, valid JSON object that adheres to the provided schema. Do not include "'''json" or any other explanatory text. Instructions: Be precise. If a line item (e.g., Amortization) is not present, set its value to 0. "OpEx" refers to Operating Expenses (or SG&A). If you cannot read the file, return: {"error": "Could not parse financial data from file."}`;
    
            const textPart = { text: aiScanPrompt };
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: [textPart, filePart] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            periods: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        year: { type: Type.STRING },
                                        Revenue: { type: Type.NUMBER },
                                        COGS: { type: Type.NUMBER },
                                        OpEx: { type: Type.NUMBER },
                                        Depreciation: { type: Type.NUMBER },
                                        Amortization: { type: Type.NUMBER },
                                        Interest: { type: Type.NUMBER },
                                        Taxes: { type: Type.NUMBER },
                                    }
                                }
                            }
                        }
                    }
                }
            });
    
            const parsedResponse = JSON.parse(response.text);
    
            if (parsedResponse.error) throw new Error(parsedResponse.error);
    
            let currentPeriods = [...data.periods];
            let periodsUpdated = 0;
            let periodsAdded = 0;
    
            parsedResponse.periods.forEach((scannedPeriod: any) => {
                const periodName = String(scannedPeriod.year);
                const existingPeriodIndex = currentPeriods.findIndex(p => p.periodName === periodName);
                
                const newValues = {
                    revenue: String(scannedPeriod.Revenue || 0),
                    cogs: String(scannedPeriod.COGS || 0),
                    operatingExpenses: String(scannedPeriod.OpEx || 0),
                    depreciation: String(scannedPeriod.Depreciation || 0),
                    amortization: String(scannedPeriod.Amortization || 0),
                    interestExpense: String(scannedPeriod.Interest || 0),
                    taxes: String(scannedPeriod.Taxes || 0),
                };
    
                if (existingPeriodIndex > -1) {
                    currentPeriods[existingPeriodIndex] = { ...currentPeriods[existingPeriodIndex], ...newValues };
                    periodsUpdated++;
                } else {
                    currentPeriods.push({ ...createNewPeriod(periodName), ...newValues });
                    periodsAdded++;
                }
            });
    
            setData({ ...data, periods: currentPeriods });
            showToast(`Scan complete: ${periodsAdded} periods added, ${periodsUpdated} updated.`);
    
        } catch (error) {
            console.error("Error scanning document:", error);
            showToast("Error: Could not parse financial data from the file.");
        } finally {
            setIsScanning(false);
            event.target.value = ''; // Reset file input
        }
    };

  const calculationResults = useMemo(() => {
    const generalAddBacks = data.addBacks.reduce((sum, b) => sum + parseNum(b.amount), 0);
    const ownerComp = parseNum(data.ownerCompAddBack);
    const totalAddBacks = generalAddBacks + ownerComp;

    const ytdMonths = parseInt(data.ytdMonths) || 1;
    const annualizationFactor = ytdMonths > 0 && ytdMonths < 12 ? 12 / ytdMonths : 1;
    
    const calculateMetrics = (p: FinancialPeriod, prevPeriod: FinancialPeriod | null = null, isAnnualized: boolean = false) => {
        // IS Metrics
        const revenue = isAnnualized ? parseNum(p.revenue) * annualizationFactor : parseNum(p.revenue);
        const cogs = isAnnualized ? parseNum(p.cogs) * annualizationFactor : parseNum(p.cogs);
        const opEx = isAnnualized ? parseNum(p.operatingExpenses) * annualizationFactor : parseNum(p.operatingExpenses);
        const depr = parseNum(p.depreciation);
        const amort = parseNum(p.amortization);
        const interest = parseNum(p.interestExpense);
        const taxes = parseNum(p.taxes);
        // BS Metrics (not annualized)
        const cash = parseNum(p.cash);
        const ar = parseNum(p.accountsReceivable);
        const inventory = parseNum(p.inventory);
        const otherCurrentAssets = parseNum(p.otherCurrentAssets);
        const longTermAssets = parseNum(p.longTermAssets);
        const ap = parseNum(p.accountsPayable);
        const shortTermDebt = parseNum(p.shortTermDebt);
        const otherCurrentLiabilities = parseNum(p.otherCurrentLiabilities);

        // Calculations
        const grossProfit = revenue - cogs;
        const ebitda = grossProfit - opEx;
        const ebit = ebitda - depr - amort;
        const netIncome = ebit - interest - taxes;
        const normalizedEbitda = ebitda + totalAddBacks - ownerComp;
        const normalizedSde = normalizedEbitda + ownerComp;

        const totalCurrentAssets = cash + ar + inventory + otherCurrentAssets;
        const totalAssets = totalCurrentAssets + longTermAssets;
        const totalCurrentLiabilities = ap + shortTermDebt + otherCurrentLiabilities;
        const netWorkingCapital = (ar + inventory + otherCurrentAssets) - (ap + otherCurrentLiabilities);
        
        const prevRevenue = prevPeriod ? parseNum(prevPeriod.revenue) : 0;
        const revenueGrowth = prevRevenue ? (revenue - prevRevenue) / prevRevenue : 0;
        
        const grossMargin = revenue ? grossProfit / revenue : 0;
        const ebitdaMargin = revenue ? ebitda / revenue : 0;
        const netMargin = revenue ? netIncome / revenue : 0;
        const currentRatio = totalCurrentLiabilities ? totalCurrentAssets / totalCurrentLiabilities : 0;
        const quickRatio = totalCurrentLiabilities ? (cash + ar) / totalCurrentLiabilities : 0;
        
        const prevAR = prevPeriod ? parseNum(prevPeriod.accountsReceivable) : ar;
        const avgAR = (ar + prevAR) / 2;
        const dso = revenue ? (avgAR / revenue) * 365 : 0;
        
        const prevAP = prevPeriod ? parseNum(prevPeriod.accountsPayable) : ap;
        const avgAP = (ap + prevAP) / 2;
        const dpo = cogs ? (avgAP / cogs) * 365 : 0;

        return {
          id: p.id, periodName: p.periodName, revenue, grossProfit, ebitda, netIncome, normalizedEbitda, normalizedSde,
          netWorkingCapital, totalAssets, revenueGrowth, grossMargin, ebitdaMargin, netMargin,
          currentRatio, quickRatio, dso, dpo,
        };
    };

    const ytdAnnualizedPeriod = { ...data.ytdActuals, periodName: `${new Date().getFullYear()} (Ann.)`, id: 'ytd-annualized' };
    const allPeriodsForCalc = [...data.periods, ytdAnnualizedPeriod].sort((a,b) => parseInt(a.periodName) - parseInt(b.periodName));

    const calculations = allPeriodsForCalc.map((p, index) => {
        const prevPeriod = index > 0 ? allPeriodsForCalc[index-1] : null;
        const isAnnualized = p.id === 'ytd-annualized';
        return calculateMetrics(p, prevPeriod, isAnnualized);
    });

    const ytdActualsCalculations = calculateMetrics(data.ytdActuals, null, false);
    
    const averageNWC = calculations.length > 0 ? calculations.reduce((sum, c) => sum + c.netWorkingCapital, 0) / calculations.length : 0;

    return { calculations, averageNWC, ytdActualsCalculations };
  }, [data]);
  
  const sortedPeriodsForDisplay = [...data.periods].sort((a,b) => parseInt(b.periodName) - parseInt(a.periodName));

  const financialStatementRows = [
      {label: 'Revenue', field: 'revenue', isInput: true, isBs: false, isBold: false},
      {label: 'COGS', field: 'cogs', isInput: true, isBs: false, isBold: false},
      {label: 'Gross Profit', field: 'grossProfit', isInput: false, isBs: false, isBold: true},
      {label: 'OpEx', field: 'operatingExpenses', isInput: true, isBs: false, isBold: false},
      {label: 'EBITDA', field: 'ebitda', isInput: false, isBs: false, isBold: true},
      {label: 'Depreciation', field: 'depreciation', isInput: true, isBs: false, isBold: false},
      {label: 'Amortization', field: 'amortization', isInput: true, isBs: false, isBold: false},
      {label: 'Interest', field: 'interestExpense', isInput: true, isBs: false, isBold: false},
      {label: 'Taxes', field: 'taxes', isInput: true, isBs: false, isBold: false},
      {label: 'Net Income', field: 'netIncome', isInput: false, isBs: false, isBold: true},
      {label: 'Cash', field: 'cash', isInput: true, isBs: true, isBold: false},
      {label: 'A/R', field: 'accountsReceivable', isInput: true, isBs: true, isBold: false},
      {label: 'Inventory', field: 'inventory', isInput: true, isBs: true, isBold: false},
      {label: 'Other Current Assets', field: 'otherCurrentAssets', isInput: true, isBs: true, isBold: false},
      {label: 'Long-Term Assets', field: 'longTermAssets', isInput: true, isBs: true, isBold: false},
      {label: 'A/P', field: 'accountsPayable', isInput: true, isBs: true, isBold: false},
      {label: 'Short-Term Debt', field: 'shortTermDebt', isInput: true, isBs: true, isBold: false},
      {label: 'Other Current Liab.', field: 'otherCurrentLiabilities', isInput: true, isBs: true, isBold: false},
      {label: 'Long-Term Debt', field: 'longTermDebt', isInput: true, isBs: true, isBold: false},
      {label: 'Shareholder Equity', field: 'shareholderEquity', isInput: true, isBs: true, isBold: false},
  ];

  return (
    <div className="bg-white rounded-lg p-6 sm:p-8 border border-slate-200 shadow-sm space-y-8">
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
            <div>
                <input
                    type="text"
                    value={data.companyName}
                    onChange={e => handleDataChange('companyName', e.target.value)}
                    className="text-xl font-bold text-amber-600 bg-transparent border-0 border-b-2 border-slate-200 focus:border-amber-500 focus:outline-none focus:ring-0 p-0 mb-1 w-full"
                    placeholder="Enter Company Name"
                />
              <p className="text-slate-500 text-sm">Input financials to verify SDE, analyze trends, and assess business health.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {isScanning && (
                    <div className="text-amber-600 flex items-center gap-2 text-sm font-medium">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Scanning...</span>
                    </div>
                )}
                <button onClick={handleSaveData} disabled={isScanning} className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md disabled:opacity-50">Save Data</button>
                <button onClick={handleLoadData} disabled={isScanning} className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md disabled:opacity-50">Load Last Saved</button>
                 <label className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed">
                    Import CSV
                    <input type="file" hidden accept=".csv, text/csv" onChange={handleImportCSV} disabled={isScanning} />
                </label>
                <label className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed">
                    Scan Statement
                    <input type="file" hidden id="scan-file-input" accept="image/png,image/jpeg,application/pdf" onChange={handleFileScan} disabled={isScanning} />
                </label>
                <button onClick={handleExportCSV} disabled={isScanning} className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md disabled:opacity-50">Export CSV</button>
                 <button onClick={onClear} disabled={isScanning} className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 rounded-md disabled:opacity-50">Reset Example</button>
            </div>
        </div>
        
        {/* --- Data Entry --- */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-3">
            <h3 className="text-lg font-semibold text-slate-800">Financial Statement Entry</h3>
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <label htmlFor="ytdMonths" className="text-sm text-slate-500">Months in YTD:</label>
                    <input id="ytdMonths" type="number" min="1" max="12" value={data.ytdMonths} onChange={e => handleDataChange('ytdMonths', e.target.value)} className="w-20 bg-white text-slate-700 border border-slate-300 rounded-md p-2 text-sm"/>
                </div>
                <div className="flex items-center gap-2">
                    <select id="common-size-select" value={commonSizeBase} onChange={e => setCommonSizeBase(e.target.value as any)} className="bg-white text-slate-700 border border-slate-300 rounded-md py-2 px-3 text-sm">
                        <option value="none">Absolute Values ($)</option>
                        <option value="revenue">Common-Size: % of Revenue (IS)</option>
                        <option value="assets">Common-Size: % of Total Assets (BS)</option>
                    </select>
                </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full">
                <thead className="text-xs">
                    <tr>
                        <th className={`${labelClasses} ${thClasses}`}>Metric</th>
                        <th className={thClasses}>YTD Actuals</th>
                        {sortedPeriodsForDisplay.map(p => (
                            <th key={p.id} className={thClasses}>
                                <div className="flex items-center justify-end gap-2">
                                <input type="text" value={p.periodName} onChange={(e) => handlePeriodChange(p.id, 'periodName', e.target.value)} className="bg-transparent text-right font-semibold w-20 border-b border-transparent focus:border-amber-500 focus:outline-none"/>
                                <button onClick={() => handleRemovePeriod(p.id)} className="text-slate-400 hover:text-red-500">&times;</button>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-100/50"><td colSpan={data.periods.length + 2} className="p-1.5 text-xs text-slate-500 font-semibold pl-4">Income Statement</td></tr>
                    {financialStatementRows.filter(r => !r.isBs).map(row => {
                       const periodCalc = (periodId: string) => calculationResults.calculations.find(c => c.id === periodId);
                       return (
                        <tr key={row.field}>
                            <td className={`${labelClasses} ${row.isBold ? 'font-semibold text-slate-700' : ''}`}>{row.label}</td>
                            <td className={`${tdClasses} text-right text-sm text-slate-800 pr-3`}>
                                {row.isInput ? (() => {
                                    const inputKey = `${data.ytdActuals.id}-${row.field}`;
                                    const isFocused = focusedInput === inputKey;
                                    const value = data.ytdActuals[row.field as keyof FinancialPeriod];
                                    return (
                                        <input
                                            type="text"
                                            value={isFocused ? value : formatNumber(value)}
                                            onFocus={() => setFocusedInput(inputKey)}
                                            onBlur={() => setFocusedInput(null)}
                                            onChange={e => handlePeriodChange(data.ytdActuals.id, row.field as keyof FinancialPeriod, e.target.value)}
                                            className={`${inputClasses} ${inputErrors[data.ytdActuals.id]?.[row.field] ? inputErrorClasses : ''}`}
                                        />
                                    );
                                })() : (
                                    <span className="px-3 block font-mono text-slate-800">{formatCurrency(calculationResults.ytdActualsCalculations[row.field as keyof typeof calculationResults.ytdActualsCalculations] as number)}</span>
                                )}
                            </td>
                            {sortedPeriodsForDisplay.map(p => {
                                const calc = periodCalc(p.id);
                                let displayVal: string | number = '';
                                if (row.isInput) {
                                    const value = parseNum(p[row.field as keyof FinancialPeriod]);
                                    if (commonSizeBase === 'revenue' && calc && calc.revenue > 0) {
                                        displayVal = formatPercent(value / calc.revenue);
                                    }
                                } else if (calc) {
                                    displayVal = formatCurrency(calc[row.field as keyof typeof calc] as number);
                                }
                                return (
                                <td key={p.id} className={`${tdClasses} text-right text-sm text-slate-800 pr-3`}>
                                    {row.isInput ? (
                                        commonSizeBase !== 'none' && commonSizeBase !== 'assets' ? (
                                             <span className="px-2">{displayVal}</span>
                                        ) : (() => {
                                            const inputKey = `${p.id}-${row.field}`;
                                            const isFocused = focusedInput === inputKey;
                                            const value = p[row.field as keyof FinancialPeriod];
                                            return (
                                                <input
                                                    type="text"
                                                    value={isFocused ? value : formatNumber(value)}
                                                    onFocus={() => setFocusedInput(inputKey)}
                                                    onBlur={() => setFocusedInput(null)}
                                                    onChange={e => handlePeriodChange(p.id, row.field as keyof FinancialPeriod, e.target.value)}
                                                    className={`${inputClasses} ${inputErrors[p.id]?.[row.field] ? inputErrorClasses : ''}`}
                                                />
                                            );
                                        })()
                                    ) : (
                                        <span className={`px-3 font-mono ${row.isBold ? 'text-slate-800' : 'text-slate-600'}`}>{displayVal}</span>
                                    )}
                                </td>
                                )
                            })}
                        </tr>
                       );
                    })}
                    <tr className="bg-slate-100/50"><td colSpan={data.periods.length + 2} className="p-1.5 text-xs text-slate-500 font-semibold pl-4">Balance Sheet</td></tr>
                    {financialStatementRows.filter(r => r.isBs).map(row => {
                         const periodCalc = (periodId: string) => calculationResults.calculations.find(c => c.id === periodId);
                         return (
                            <tr key={row.field}>
                                <td className={labelClasses}>{row.label}</td>
                                <td className={tdClasses}>{
                                    (() => {
                                        const inputKey = `${data.ytdActuals.id}-${row.field}`;
                                        const isFocused = focusedInput === inputKey;
                                        const value = data.ytdActuals[row.field as keyof FinancialPeriod];
                                        return (
                                            <input
                                                type="text"
                                                value={isFocused ? value : formatNumber(value)}
                                                onFocus={() => setFocusedInput(inputKey)}
                                                onBlur={() => setFocusedInput(null)}
                                                onChange={e => handlePeriodChange(data.ytdActuals.id, row.field as keyof FinancialPeriod, e.target.value)}
                                                className={`${inputClasses} ${inputErrors[data.ytdActuals.id]?.[row.field] ? inputErrorClasses : ''}`}
                                            />
                                        );
                                    })()
                                }</td>
                                {sortedPeriodsForDisplay.map(p => {
                                    const calc = periodCalc(p.id);
                                    const value = parseNum(p[row.field as keyof FinancialPeriod]);
                                    let displayVal: string | number = '';
                                    if (commonSizeBase === 'assets' && calc && calc.totalAssets > 0) {
                                        displayVal = formatPercent(value / calc.totalAssets);
                                    }
                                    return (
                                        <td key={p.id} className={`${tdClasses} text-right text-sm text-slate-800 pr-3`}>
                                            {commonSizeBase !== 'none' && commonSizeBase !== 'revenue' ? (
                                                <span className="px-2">{displayVal}</span>
                                            ) : (
                                                (() => {
                                                    const inputKey = `${p.id}-${row.field}`;
                                                    const isFocused = focusedInput === inputKey;
                                                    const value = p[row.field as keyof FinancialPeriod];
                                                    return (
                                                        <input
                                                            type="text"
                                                            value={isFocused ? value : formatNumber(value)}
                                                            onFocus={() => setFocusedInput(inputKey)}
                                                            onBlur={() => setFocusedInput(null)}
                                                            onChange={e => handlePeriodChange(p.id, row.field as keyof FinancialPeriod, e.target.value)}
                                                            className={`${inputClasses} ${inputErrors[p.id]?.[row.field] ? inputErrorClasses : ''}`}
                                                        />
                                                    );
                                                })()
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                         );
                    })}
                </tbody>
            </table>
          </div>
          <div className="flex justify-between items-start mt-4 gap-4">
            <button onClick={handleAddPeriod} className="px-4 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 transition">+ Add Period</button>
            <div className="flex-grow">
                <label className="text-sm font-medium text-slate-500">Financial Statement Notes</label>
                <textarea value={data.financialNotes} onChange={e => handleDataChange('financialNotes', e.target.value)} rows={2} className={`${inputClasses} text-left mt-1`}></textarea>
            </div>
          </div>
        </div>

        {/* --- Normalization Engine & Waterfall --- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
                 <h3 className="text-lg font-semibold text-slate-800 mb-3">Normalization / Add-Backs</h3>
                 <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-end gap-4">
                        <div className="flex-grow">
                            <label className="text-sm font-medium text-slate-500">Owner Compensation Add-Back</label>
                            {(() => {
                                const inputKey = 'ownerCompAddBack';
                                const isFocused = focusedInput === inputKey;
                                const value = data.ownerCompAddBack;
                                return (
                                    <input
                                        type="text"
                                        value={isFocused ? value : formatNumber(value)}
                                        onFocus={() => setFocusedInput(inputKey)}
                                        onBlur={() => setFocusedInput(null)}
                                        onChange={e => handleDataChange('ownerCompAddBack', e.target.value.replace(/,/g, ''))}
                                        className={`${inputClasses} mt-1`}
                                    />
                                );
                            })()}
                        </div>
                        <span className="text-slate-700 font-bold text-lg pb-2">= ${formatCurrency(parseNum(data.ownerCompAddBack))}</span>
                    </div>
                    <div>
                        <table className="w-full">
                            <thead><tr>
                                <th className="p-2 text-xs text-slate-500 font-medium text-left">Other Add-Backs</th>
                                <th className="p-2 text-xs text-slate-500 font-medium text-left">Category</th>
                                <th className="p-2 text-xs text-slate-500 font-medium text-right">Amount</th>
                                <th className="p-2 w-10"></th>
                            </tr></thead>
                            <tbody>
                                {data.addBacks.map(b => {
                                    const inputKey = `${b.id}-amount`;
                                    const isFocused = focusedInput === inputKey;
                                    const value = b.amount;
                                    return (
                                    <tr key={b.id}>
                                        <td className="p-1"><input type="text" value={b.description} onChange={e => handleAddBackChange(b.id, 'description', e.target.value)} placeholder="e.g., Owner Personal Travel" className={`${inputClasses} text-left`} /></td>
                                        <td className="p-1 w-48">
                                            <select value={b.category} onChange={e => handleAddBackChange(b.id, 'category', e.target.value as AddBack['category'])} className={`${inputClasses} text-left`}>
                                                {ADD_BACK_CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-1 w-40">
                                            <input
                                                type="text"
                                                value={isFocused ? value : formatNumber(value)}
                                                onFocus={() => setFocusedInput(inputKey)}
                                                onBlur={() => setFocusedInput(null)}
                                                onChange={e => handleAddBackChange(b.id, 'amount', e.target.value)}
                                                className={inputClasses}
                                            />
                                        </td>
                                        <td className="p-1 text-center"><button onClick={() => handleRemoveAddBack(b.id)} className="text-slate-400 hover:text-red-500">&times;</button></td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                        <button onClick={handleAddBack} className="mt-3 px-4 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 transition">+ Add Item</button>
                    </div>
                     <div>
                        <label className="text-sm font-medium text-slate-500">Add-Back Rationale</label>
                        <textarea value={data.addBackNotes} onChange={e => handleDataChange('addBackNotes', e.target.value)} rows={2} className={`${inputClasses} text-left mt-1`}></textarea>
                    </div>
                 </div>
            </div>
            <div className="lg:col-span-2">
                 <h3 className="text-lg font-semibold text-slate-800 mb-3">SDE & EBITDA Waterfall</h3>
                 <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2 h-full">
                     {calculationResults.calculations.slice().reverse().map(calc => (
                        <div key={calc.periodName} className="p-2 border-b border-slate-200/50 last:border-b-0">
                            <h4 className="font-semibold text-amber-600">{calc.periodName}</h4>
                            <dl className="text-sm mt-1">
                                <div className="flex justify-between py-1"><dt className="text-slate-500">Net Income</dt><dd className="font-mono text-slate-700">{formatCurrency(calc.netIncome)}</dd></div>
                                <div className="flex justify-between py-1"><dt className="text-slate-500">+ I/T/D/A</dt><dd className="font-mono text-slate-700">{formatCurrency(calc.ebitda - calc.netIncome)}</dd></div>
                                <div className="flex justify-between py-1 border-t border-slate-200"><dt className="text-slate-600 font-medium">EBITDA</dt><dd className="font-mono text-slate-800 font-medium">{formatCurrency(calc.ebitda)}</dd></div>
                                <div className="flex justify-between py-1"><dt className="text-slate-500">+ Other Add-Backs</dt><dd className="font-mono text-slate-700">{formatCurrency(data.addBacks.reduce((s,b)=>s+parseNum(b.amount),0))}</dd></div>
                                <div className="flex justify-between py-1 border-t border-slate-200"><dt className="text-slate-600 font-medium">Normalized EBITDA</dt><dd className="font-mono text-slate-800 font-medium">{formatCurrency(calc.normalizedEbitda)}</dd></div>
                                <div className="flex justify-between py-1"><dt className="text-slate-500">+ Owner Comp</dt><dd className="font-mono text-slate-700">{formatCurrency(parseNum(data.ownerCompAddBack))}</dd></div>
                                <div className="flex justify-between py-1 border-t border-slate-300"><dt className="text-amber-700 font-semibold">Normalized SDE</dt><dd className="font-mono text-amber-700 font-semibold">{formatCurrency(calc.normalizedSde)}</dd></div>
                            </dl>
                        </div>
                     ))}
                 </div>
            </div>
        </div>
        
        {/* --- Key Ratios Table & Benchmarks --- */}
        <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Key Ratio Analysis</h3>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
                <div className="lg:col-span-1 p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                    <h4 className="text-base font-semibold text-slate-700 mb-3">Industry Benchmarks</h4>
                    <div className="space-y-3">
                        <div><label className="text-sm text-slate-500">Gross Margin %</label><input type="text" name="grossMarginPercent" value={benchmarks.grossMarginPercent} onChange={handleBenchmarkChange} className={`${inputClasses} mt-1`} /></div>
                        <div><label className="text-sm text-slate-500">EBITDA Margin %</label><input type="text" name="ebitdaMarginPercent" value={benchmarks.ebitdaMarginPercent} onChange={handleBenchmarkChange} className={`${inputClasses} mt-1`} /></div>
                        <div><label className="text-sm text-slate-500">Current Ratio</label><input type="text" name="currentRatio" value={benchmarks.currentRatio} onChange={handleBenchmarkChange} className={`${inputClasses} mt-1`} /></div>
                        <div><label className="text-sm text-slate-500">Benchmark DSO (Days)</label><input type="text" name="dso" value={benchmarks.dso} onChange={handleBenchmarkChange} className={`${inputClasses} mt-1`} /></div>
                        <div><label className="text-sm text-slate-500">Benchmark DPO (Days)</label><input type="text" name="dpo" value={benchmarks.dpo} onChange={handleBenchmarkChange} className={`${inputClasses} mt-1`} /></div>
                    </div>
                </div>
                <div className="lg:col-span-3 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100/80"><tr>
                            <th className="p-2 text-xs text-slate-500 font-medium text-left sticky left-0 bg-slate-100/80 z-10">Ratio</th>
                            <th className="p-2 text-xs text-slate-500 font-medium text-right">Benchmark</th>
                            {calculationResults.calculations.map(c => <th key={c.periodName} className="p-2 text-xs text-slate-500 font-medium text-right">{c.periodName}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-slate-200">
                            {[
                                { label: 'Gross Margin %', key: 'grossMargin', format: formatPercent, benchmark: parseNum(benchmarks.grossMarginPercent) / 100 },
                                { label: 'EBITDA Margin %', key: 'ebitdaMargin', format: formatPercent, benchmark: parseNum(benchmarks.ebitdaMarginPercent) / 100 },
                                { label: 'Net Margin %', key: 'netMargin', format: formatPercent },
                                { label: 'Current Ratio', key: 'currentRatio', format: formatRatio, benchmark: parseNum(benchmarks.currentRatio) },
                                { label: 'Quick Ratio', key: 'quickRatio', format: formatRatio },
                                { label: 'DSO (Days)', key: 'dso', format: formatDays, benchmark: parseNum(benchmarks.dso) },
                                { label: 'DPO (Days)', key: 'dpo', format: formatDays, benchmark: parseNum(benchmarks.dpo) },
                            ].map(r => (
                                <tr key={r.label}>
                                    <td className="p-2 font-medium text-slate-500 text-left sticky left-0 bg-white z-10">{r.label}</td>
                                    <td className="p-2 font-mono text-slate-500 text-right">{r.benchmark ? r.format(r.benchmark) : 'N/A'}</td>
                                    {calculationResults.calculations.map(c => {
                                        const val = c[r.key as keyof typeof c] as number;
                                        const isBetter = r.benchmark && (r.key === 'dso' || r.key === 'dpo' ? val < r.benchmark : val > r.benchmark);
                                        const isWorse = r.benchmark && (r.key === 'dso' || r.key === 'dpo' ? val > r.benchmark : val < r.benchmark);
                                        return <td key={c.periodName} className={`p-2 font-mono text-right ${isBetter ? 'text-green-600' : isWorse ? 'text-red-600' : 'text-slate-700'}`}>{r.format(val)}</td>
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* --- NWC Analysis --- */}
        <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Net Working Capital Analysis</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                     <table className="w-full text-sm">
                        <thead className="bg-slate-100/80"><tr>
                            {calculationResults.calculations.map(c => <th key={c.periodName} className="p-2 text-xs text-slate-500 font-medium text-right">{c.periodName}</th>)}
                        </tr></thead>
                        <tbody><tr>
                            {calculationResults.calculations.map(c => <td key={c.periodName} className="p-2 font-mono text-slate-700 text-right">{formatCurrency(c.netWorkingCapital)}</td>)}
                        </tr></tbody>
                    </table>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 text-center">
                    <h4 className="text-base font-semibold text-slate-700">Calculated NWC Peg</h4>
                    <p className="text-sm text-slate-500 mb-2">(Based on Average NWC of Displayed Periods)</p>
                    <p className="text-4xl font-bold text-amber-600">{formatCurrency(calculationResults.averageNWC)}</p>
                </div>
            </div>
        </div>

        {/* --- Trend Analysis Charts --- */}
        <div>
             <h3 className="text-lg font-semibold text-slate-800 mb-3">Trend Analysis</h3>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-semibold text-slate-700 mb-2">Profitability & SDE</h4>
                  <ResponsiveContainer width="100%" height={250}>
                     <ComposedChart data={calculationResults.calculations}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="periodName" stroke="#64748b" fontSize={12} />
                        <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickFormatter={(val) => formatCurrency(val, true)} />
                        <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickFormatter={formatPercent} />
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} formatter={(value: any, name: any) => [name === 'EBITDA Margin' ? formatPercent(value) : formatCurrency(value), name]}/>
                        <Legend wrapperStyle={{fontSize: "12px"}}/>
                        <Bar yAxisId="left" dataKey="normalizedSde" name="Norm. SDE" fill="#f59e0b" fillOpacity={0.6} />
                        <Line yAxisId="right" type="monotone" dataKey="ebitdaMargin" name="EBITDA Margin" stroke="#10b981" strokeWidth={2} dot={false} />
                     </ComposedChart>
                  </ResponsiveContainer>
                </div>
                 <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="font-semibold text-slate-700 mb-2">Revenue Growth (YoY)</h4>
                   <ResponsiveContainer width="100%" height={250}>
                     <AreaChart data={calculationResults.calculations}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="periodName" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} tickFormatter={formatPercent} domain={[-0.5, 0.5]}/>
                        <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} formatter={(value:any) => [formatPercent(value), "YoY Growth"]}/>
                        <Area type="monotone" dataKey="revenueGrowth" name="YoY Growth" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                     </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>
        </div>
        {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
};

export default FinancialAnalysisHub;