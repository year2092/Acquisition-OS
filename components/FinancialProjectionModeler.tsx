import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FinancialAnalysisData } from './FinancialAnalysisHub';
import { ValuationInputs } from './ValuationCalculator';

// --- Interfaces --- //
export interface Assumptions {
  revenueGrowthY1_monthly: string;
  revenueGrowthY2_annual: string;
  revenueGrowthY3_annual: string;
  cogsPercentOfRevenue: string;
  opExCalculationMode: 'percentOfRevenue' | 'fixedAmount';
  opExPercentOfRevenue: string;
  opExFixedAmount: string;
  opExGrowthAnnual: string;
  annualCapex: string;
  debtServiceAnnual: string;
  effectiveTaxRate: string;
  startingRevenue: string;
  startingEbitda: string;
}

export interface ProjectionData {
  assumptions: Assumptions;
}

// Props Interface
interface FinancialProjectionModelerProps {
    data: ProjectionData | null;
    setData: React.Dispatch<React.SetStateAction<ProjectionData | null>>;
    onClear: () => void;
    financialAnalysisData: FinancialAnalysisData | null;
    valuationInputs: ValuationInputs | null;
}

// Constants & Helpers
const defaultAssumptions: Assumptions = {
    revenueGrowthY1_monthly: '1.0',
    revenueGrowthY2_annual: '10.0',
    revenueGrowthY3_annual: '8.0',
    cogsPercentOfRevenue: '60.0',
    opExCalculationMode: 'percentOfRevenue',
    opExPercentOfRevenue: '25.0',
    opExFixedAmount: '500000',
    opExGrowthAnnual: '3.0',
    annualCapex: '25000',
    debtServiceAnnual: '136500',
    effectiveTaxRate: '25.0',
    startingRevenue: '2500000',
    startingEbitda: '375000',
};

const parseNum = (val: string | number) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

const inputClasses = "w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm transition focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 placeholder:text-slate-400";
const thClasses = "p-2 text-xs text-slate-500 font-medium text-right whitespace-nowrap bg-slate-100/80 backdrop-blur-sm";
const tdClasses = "p-2 text-sm text-right font-mono text-slate-700";

// Main Component
const FinancialProjectionModeler: React.FC<FinancialProjectionModelerProps> = ({ data, setData, onClear, financialAnalysisData, valuationInputs }) => {
    const assumptions = data?.assumptions ?? defaultAssumptions;

    const handleAssumptionChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const newAssumptions = { ...assumptions, [name]: value };
        setData({ assumptions: newAssumptions });
    };

    const handleLoadFromAnalysis = () => {
        let updatedAssumptions = { ...assumptions };
        let loadedSomething = false;

        // Load from Financial Analysis Hub
        if (financialAnalysisData) {
            const ytdMonths = parseInt(financialAnalysisData.ytdMonths) || 12;
            const annualizationFactor = ytdMonths > 0 && ytdMonths < 12 ? 12 / ytdMonths : 1;

            const lastPeriod = financialAnalysisData.periods.sort((a,b) => parseInt(b.periodName) - parseInt(a.periodName))[0];
            const basePeriod = ytdMonths === 12 ? financialAnalysisData.ytdActuals : lastPeriod || financialAnalysisData.ytdActuals;

            const revenue = parseNum(basePeriod.revenue) * (ytdMonths === 12 ? 1 : annualizationFactor);
            const cogs = parseNum(basePeriod.cogs) * (ytdMonths === 12 ? 1 : annualizationFactor);
            const opEx = parseNum(basePeriod.operatingExpenses) * (ytdMonths === 12 ? 1 : annualizationFactor);
            const ebitda = revenue - cogs - opEx;

            updatedAssumptions.startingRevenue = String(Math.round(revenue));
            updatedAssumptions.startingEbitda = String(Math.round(ebitda));
            if (revenue > 0) {
                updatedAssumptions.cogsPercentOfRevenue = ((cogs / revenue) * 100).toFixed(1);
                updatedAssumptions.opExPercentOfRevenue = ((opEx / revenue) * 100).toFixed(1);
            }
            loadedSomething = true;
        }

        // Load from Valuation Calculator
        if (valuationInputs) {
            const numLoanAmount = parseNum(valuationInputs.loanAmount);
            const numSellerNote = parseNum(valuationInputs.amortizingSellerNoteAmount);
            // Simple debt service calculation
            const debtService = (numLoanAmount * 0.13) + (numSellerNote * 0.05);
            updatedAssumptions.debtServiceAnnual = String(Math.round(debtService));
            loadedSomething = true;
        }
        
        if (loadedSomething) {
            setData({ assumptions: updatedAssumptions });
        } else {
            alert("No data available in Financial Analysis or Valuation hubs to load.");
        }
    };
    
    const projections = useMemo(() => {
        const monthlyProjections: any[] = [];
        const annualTotals: { [key: string]: any } = {};

        const p = {
            revGrowthMonthly: parseNum(assumptions.revenueGrowthY1_monthly) / 100,
            revGrowthY2: parseNum(assumptions.revenueGrowthY2_annual) / 100,
            revGrowthY3: parseNum(assumptions.revenueGrowthY3_annual) / 100,
            cogsPct: parseNum(assumptions.cogsPercentOfRevenue) / 100,
            opExPct: parseNum(assumptions.opExPercentOfRevenue) / 100,
            opExFixed: parseNum(assumptions.opExFixedAmount),
            opExGrowth: parseNum(assumptions.opExGrowthAnnual) / 100,
            capex: parseNum(assumptions.annualCapex),
            debtService: parseNum(assumptions.debtServiceAnnual),
            taxRate: parseNum(assumptions.effectiveTaxRate) / 100,
            startRev: parseNum(assumptions.startingRevenue),
        };

        let lastMonthRevenue = p.startRev / 12;

        // Year 1 Monthly
        for (let i = 1; i <= 12; i++) {
            const revenue = lastMonthRevenue * (1 + p.revGrowthMonthly);
            const cogs = revenue * p.cogsPct;
            const grossProfit = revenue - cogs;
            const opEx = assumptions.opExCalculationMode === 'percentOfRevenue' ? revenue * p.opExPct : p.opExFixed / 12;
            const ebitda = grossProfit - opEx;
            const debtService = p.debtService / 12;
            const capex = p.capex / 12;
            const ebt = ebitda - debtService; // Simplified
            const taxes = ebt > 0 ? ebt * p.taxRate : 0;
            const netIncome = ebt - taxes;
            const fcf = ebitda - taxes - capex;
            
            monthlyProjections.push({ periodName: `M${i}`, revenue, cogs, grossProfit, opEx, ebitda, capex, taxes, netIncome, fcf });
            lastMonthRevenue = revenue;
        }

        // Year 1 Total
        annualTotals['Y1'] = monthlyProjections.reduce((acc, month) => {
            Object.keys(month).forEach(key => {
                if (key !== 'periodName') acc[key] = (acc[key] || 0) + month[key];
            });
            return acc;
        }, { periodName: 'Y1 Total' });

        // Year 2 & 3
        let lastYear = annualTotals['Y1'];
        for (let i = 2; i <= 3; i++) {
            const revGrowth = i === 2 ? p.revGrowthY2 : p.revGrowthY3;
            const revenue = lastYear.revenue * (1 + revGrowth);
            const cogs = revenue * p.cogsPct;
            const grossProfit = revenue - cogs;
            const opEx = assumptions.opExCalculationMode === 'percentOfRevenue' ? revenue * p.opExPct : lastYear.opEx * (1 + p.opExGrowth);
            const ebitda = grossProfit - opEx;
            const debtService = p.debtService; // Assuming constant for simplicity
            const capex = p.capex; // Assuming constant
            const ebt = ebitda - debtService;
            const taxes = ebt > 0 ? ebt * p.taxRate : 0;
            const netIncome = ebt - taxes;
            const fcf = ebitda - taxes - capex;

            annualTotals[`Y${i}`] = { periodName: `Y${i}`, revenue, cogs, grossProfit, opEx, ebitda, capex, taxes, netIncome, fcf };
            lastYear = annualTotals[`Y${i}`];
        }

        return { monthly: monthlyProjections, annual: [annualTotals['Y1'], annualTotals['Y2'], annualTotals['Y3']] };
    }, [assumptions]);
    
    const chartData = projections.annual.map(year => ({
        name: year.periodName,
        Revenue: year.revenue,
        EBITDA: year.ebitda,
        "Free Cash Flow": year.fcf,
    }));

    return (
        <div className="bg-white rounded-lg p-6 sm:p-8 border border-slate-200 shadow-sm space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                <div>
                    <h2 className="text-xl font-bold text-amber-600 mb-1">Financial Projection Modeler</h2>
                    <p className="text-slate-500 text-sm">Build a pro forma to estimate post-acquisition performance.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={handleLoadFromAnalysis} className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md">Load from Analysis</button>
                    <button onClick={onClear} className="px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md">Reset Assumptions</button>
                </div>
            </div>

            {/* Assumptions */}
            <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Assumptions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 space-y-3">
                        <h4 className="font-semibold text-slate-700">Base Figures</h4>
                        <label className="block text-xs text-slate-500">Starting Annual Revenue <input name="startingRevenue" value={assumptions.startingRevenue} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                        <label className="block text-xs text-slate-500">Starting Annual EBITDA <input name="startingEbitda" value={assumptions.startingEbitda} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                    </div>
                    <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 space-y-3">
                        <h4 className="font-semibold text-slate-700">Revenue Growth</h4>
                        <label className="block text-xs text-slate-500">Y1 Monthly Growth % <input name="revenueGrowthY1_monthly" value={assumptions.revenueGrowthY1_monthly} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                        <label className="block text-xs text-slate-500">Y2 Annual Growth % <input name="revenueGrowthY2_annual" value={assumptions.revenueGrowthY2_annual} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                        <label className="block text-xs text-slate-500">Y3 Annual Growth % <input name="revenueGrowthY3_annual" value={assumptions.revenueGrowthY3_annual} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                    </div>
                     <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 space-y-3">
                        <h4 className="font-semibold text-slate-700">Costs</h4>
                        <label className="block text-xs text-slate-500">COGS (% of Revenue) <input name="cogsPercentOfRevenue" value={assumptions.cogsPercentOfRevenue} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                        <select name="opExCalculationMode" value={assumptions.opExCalculationMode} onChange={handleAssumptionChange} className={`${inputClasses} text-xs`}>
                            <option value="percentOfRevenue">OpEx as % of Revenue</option>
                            <option value="fixedAmount">OpEx as Fixed Amount</option>
                        </select>
                        {assumptions.opExCalculationMode === 'percentOfRevenue' ? (
                             <label className="block text-xs text-slate-500">OpEx (% of Revenue) <input name="opExPercentOfRevenue" value={assumptions.opExPercentOfRevenue} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                        ) : (
                            <>
                             <label className="block text-xs text-slate-500">Fixed Annual OpEx <input name="opExFixedAmount" value={assumptions.opExFixedAmount} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                             <label className="block text-xs text-slate-500">OpEx Annual Growth % <input name="opExGrowthAnnual" value={assumptions.opExGrowthAnnual} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                            </>
                        )}
                    </div>
                     <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-200 space-y-3">
                        <h4 className="font-semibold text-slate-700">Capital & Taxes</h4>
                        <label className="block text-xs text-slate-500">Annual CapEx <input name="annualCapex" value={assumptions.annualCapex} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                        <label className="block text-xs text-slate-500">Annual Debt Service <input name="debtServiceAnnual" value={assumptions.debtServiceAnnual} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                        <label className="block text-xs text-slate-500">Effective Tax Rate % <input name="effectiveTaxRate" value={assumptions.effectiveTaxRate} onChange={handleAssumptionChange} className={`${inputClasses} mt-1`} /></label>
                    </div>
                </div>
            </div>
            
            {/* Projections */}
            <div>
                 <h3 className="text-lg font-semibold text-slate-800 mb-3">Projections</h3>
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full">
                            <thead><tr>
                                <th className={`${thClasses} text-left sticky left-0 bg-slate-100 z-10`}>Metric</th>
                                {projections.monthly.map(m => <th key={m.periodName} className={thClasses}>{m.periodName}</th>)}
                                <th className={thClasses}>Y1 Total</th>
                                <th className={thClasses}>Y2</th>
                                <th className={thClasses}>Y3</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-200">
                                {['revenue', 'cogs', 'grossProfit', 'opEx', 'ebitda', 'capex', 'taxes', 'netIncome', 'fcf'].map(metric => (
                                <tr key={metric}>
                                    <td className="p-2 text-xs text-slate-500 text-left sticky left-0 bg-white z-10 whitespace-nowrap">{metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</td>
                                    {projections.monthly.map(m => <td key={m.periodName} className={tdClasses}>{formatCurrency(m[metric])}</td>)}
                                    {projections.annual.map(a => <td key={a.periodName} className={`${tdClasses} bg-slate-100/50 font-semibold text-slate-800`}>{formatCurrency(a[metric])}</td>)}
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 min-h-[300px]">
                        <h4 className="font-semibold text-slate-700 mb-2">Annual Trends</h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }} formatter={(value: any) => [formatCurrency(value), null]} />
                                <Legend wrapperStyle={{fontSize: "12px"}}/>
                                <Line type="monotone" dataKey="Revenue" stroke="#3b82f6" />
                                <Line type="monotone" dataKey="EBITDA" stroke="#10b981" />
                                <Line type="monotone" dataKey="Free Cash Flow" stroke="#f59e0b" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default FinancialProjectionModeler;