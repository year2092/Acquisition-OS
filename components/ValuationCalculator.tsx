import React, { useState, useMemo, useEffect } from 'react';

// --- State Interfaces ---
export interface ValuationInputs {
  sde: string;
  askingMultiple: string;
  ownerSalary: string;
  closingCosts: string;
  liquidityMonths: string;
  loanAmount: string;
  sbaTerm: string;
  sbaRate: string;
  amortizingSellerNoteAmount: string;
  standbySellerNoteAmount: string;
  forgivableSellerNoteAmount: string;
  amortizingNoteTerm: string;
  amortizingNoteRate: string;
  amortizingNoteType: 'interestOnly' | 'amortizing';
  stressTestPercent: string;
  standbyNoteRate: string;
  standbyNoteTerm: string;
  forgivenessPeriod: string;
  forgivenessCondition: string;
}

interface ValuationCalculatorProps {
    inputs: ValuationInputs | null;
    setInputs: React.Dispatch<React.SetStateAction<ValuationInputs | null>>;
    onClear: () => void;
}

interface ValuationErrors {
  loanAmount?: string;
  amortizingSellerNoteAmount?: string;
  standbySellerNoteAmount?: string;
  forgivableSellerNoteAmount?: string;
}

// --- Component-local UI Helpers (to replace Shadcn) ---

const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = (props) => (
    <label {...props} className={`block text-sm font-medium text-slate-500 ${props.className}`} />
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm transition focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/80 disabled:opacity-50 ${props.className}`} />
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' }> = ({ variant = 'default', ...props }) => {
    const baseClasses = "px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const variantClasses = variant === 'default'
        ? "bg-amber-500 text-gray-900 hover:bg-amber-600 font-semibold"
        : "border border-slate-300 bg-transparent hover:bg-slate-100 text-slate-700";
    return <button {...props} className={`${baseClasses} ${variantClasses} ${props.className}`} />;
};

const Switch: React.FC<{ id: string; checked: boolean; onCheckedChange: (checked: boolean) => void; }> = ({ id, checked, onCheckedChange }) => (
    <label htmlFor={id} className="relative inline-flex items-center cursor-pointer">
        <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange(e.target.checked)}
            className="sr-only peer"
        />
        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-amber-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
    </label>
);


// --- Utility Functions ---
const parseCurrency = (value: string): number => {
  return Number(value.replace(/[^0-9.]/g, '')) || 0;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
};

const defaultInputs: ValuationInputs = {
    sde: '500,000',
    askingMultiple: '3.0',
    ownerSalary: '120,000',
    closingCosts: '40,000',
    liquidityMonths: '3',
    loanAmount: '1,050,000',
    sbaTerm: '10',
    sbaRate: '9.5',
    amortizingSellerNoteAmount: '150,000',
    standbySellerNoteAmount: '150,000',
    forgivableSellerNoteAmount: '150,000',
    amortizingNoteTerm: '5',
    amortizingNoteRate: '6.0',
    amortizingNoteType: 'interestOnly',
    stressTestPercent: '10',
    standbyNoteRate: '6.0',
    standbyNoteTerm: '10',
    forgivenessPeriod: '2',
    forgivenessCondition: 'Seller stays on as full-time consultant for the forgiveness period.',
};

// --- Main Component ---
const ValuationCalculator: React.FC<ValuationCalculatorProps> = ({ inputs: propInputs, setInputs, onClear }) => {
  const [isAdvancedView, setIsAdvancedView] = useState<boolean>(false);
  const [showAdvancedSellerNotes, setShowAdvancedSellerNotes] = useState<boolean>(false);
  const [isStressed, setIsStressed] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValuationErrors>({});

  const inputs = propInputs ?? defaultInputs;

  // --- Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...(prev ?? defaultInputs), [name]: value }));
  };
  
  const handleSelectChange = (name: keyof ValuationInputs, value: string) => {
    setInputs(prev => ({ ...(prev ?? defaultInputs), [name]: value }));
  };
  
  // --- Calculations ---
  const calculations = useMemo(() => {
    const numSDE = parseCurrency(inputs.sde);
    const numAskingMultiple = parseFloat(inputs.askingMultiple) || 0;
    const numLoanAmount = parseCurrency(inputs.loanAmount);
    
    const numAmortizingSellerNote = parseCurrency(inputs.amortizingSellerNoteAmount);
    const numStandbySellerNote = parseCurrency(inputs.standbySellerNoteAmount);
    const numForgivableSellerNote = parseCurrency(inputs.forgivableSellerNoteAmount);
    const totalSellerFinancing = numAmortizingSellerNote + numStandbySellerNote + numForgivableSellerNote;

    const numOwnerSalary = parseCurrency(inputs.ownerSalary);
    const numClosingCosts = parseCurrency(inputs.closingCosts);
    const numLiquidityMonths = parseInt(inputs.liquidityMonths, 10) || 0;
    const numSbaTerm = parseInt(inputs.sbaTerm, 10) || 0;
    const numSbaRate = parseFloat(inputs.sbaRate) || 0;
    const numAmortizingNoteTerm = parseInt(inputs.amortizingNoteTerm, 10) || 0;
    const numAmortizingNoteRate = parseFloat(inputs.amortizingNoteRate) || 0;
    const numStressTestPercent = parseFloat(inputs.stressTestPercent) || 0;

    const enterpriseValue = numSDE * numAskingMultiple;
    const buyerEquity = enterpriseValue - numLoanAmount - totalSellerFinancing;

    let validationErrors: ValuationErrors = {};
    const totalDebt = numLoanAmount + totalSellerFinancing;
    if (totalDebt > enterpriseValue) {
      const errorMsg = 'Total debt cannot exceed EV.';
      validationErrors.loanAmount = errorMsg;
      validationErrors.amortizingSellerNoteAmount = errorMsg;
      validationErrors.standbySellerNoteAmount = errorMsg;
      validationErrors.forgivableSellerNoteAmount = errorMsg;
    }

    let sbaDebtService: number;
    let sellerNoteDebtService: number;

    const monthlySbaRate = numSbaRate / 100 / 12;
    const numSbaPayments = numSbaTerm * 12;
    const monthlySbaPayment = (numSbaPayments > 0 && monthlySbaRate > 0)
      ? (numLoanAmount * monthlySbaRate) / (1 - Math.pow(1 + monthlySbaRate, -numSbaPayments))
      : (numSbaPayments > 0 ? numLoanAmount / numSbaPayments : 0);
    sbaDebtService = monthlySbaPayment * 12;
    
    if (isAdvancedView) {
      if (inputs.amortizingNoteType === 'interestOnly') {
        sellerNoteDebtService = numAmortizingSellerNote * (numAmortizingNoteRate / 100);
      } else {
        const monthlySellerRate = numAmortizingNoteRate / 100 / 12;
        const numSellerPayments = numAmortizingNoteTerm * 12;
        const monthlySellerPayment = (numSellerPayments > 0 && monthlySellerRate > 0)
          ? (numAmortizingSellerNote * monthlySellerRate) / (1 - Math.pow(1 + monthlySellerRate, -numSellerPayments))
          : (numSellerPayments > 0 ? numAmortizingSellerNote / numSellerPayments : 0);
        sellerNoteDebtService = monthlySellerPayment * 12;
      }
    } else {
      sbaDebtService = numLoanAmount * 0.13; // 13% rule
      sellerNoteDebtService = numAmortizingSellerNote * 0.05; // 5% I/O rule
    }
    
    const totalDebtService = sbaDebtService + sellerNoteDebtService;

    const sdeForCalc = isStressed ? numSDE * (1 - numStressTestPercent / 100) : numSDE;
    const cashAvailableForDebt = sdeForCalc - numOwnerSalary;
    
    const dscr = totalDebtService > 0 ? cashAvailableForDebt / totalDebtService : 0;
    const netCashFlowToOwner = cashAvailableForDebt - totalDebtService;
    
    const liquidityTarget = (totalDebtService / 12) * numLiquidityMonths;
    const totalCashToClose = buyerEquity + numClosingCosts + (isAdvancedView ? liquidityTarget : 0);

    const dscrThreshold = isAdvancedView ? 1.5 : 1.25;
    const isDscrLow = dscr < dscrThreshold;

    return {
      enterpriseValue, buyerEquity, sbaDebtService, sellerNoteDebtService, totalDebtService,
      totalCashToClose, dscr, netCashFlowToOwner, isDscrLow, liquidityTarget, validationErrors,
      totalSellerFinancing
    };
  }, [inputs, isAdvancedView, isStressed]);

  useEffect(() => {
    setErrors(calculations.validationErrors);
  }, [calculations.validationErrors]);

  const OutputCard: React.FC<{ title: string, value: string, description?: string, valueClassName?: string }> = ({ title, value, description, valueClassName }) => (
      <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg">
          <div className="p-6 pb-2">
              <p className="text-sm text-slate-500">{title}</p>
          </div>
          <div className="p-6 pt-0">
              <p className={`text-3xl font-bold ${valueClassName || 'text-slate-900'}`}>{value}</p>
              {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
          </div>
      </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto bg-white border border-slate-200 text-slate-800 rounded-lg shadow-sm">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-amber-600">Valuation & Structure</h2>
            <p className="text-slate-500 mt-1">Perform "Five-Minute Math" on a target based on Chapters 5 & 6.</p>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline" onClick={onClear}>Reset Form</Button>
             <div className="flex items-center">
                <Button variant={!isAdvancedView ? "default" : "outline"} onClick={() => setIsAdvancedView(false)} className="rounded-r-none">Simple</Button>
                <Button variant={isAdvancedView ? "default" : "outline"} onClick={() => setIsAdvancedView(true)} className="rounded-l-none">Advanced</Button>
             </div>
          </div>
        </div>
      </div>
      <div className="p-6 pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* --- Inputs Column --- */}
          <div className="space-y-6">
            {isAdvancedView && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg">
                <div className="p-6 flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Label htmlFor="stress-test-switch" className="text-slate-700">Stress Test SDE</Label>
                    <p className="text-xs text-slate-500">Reduce SDE by a percentage to test downside scenarios.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isStressed && (
                      <div className="relative">
                        <Input type="text" name="stressTestPercent" value={inputs.stressTestPercent} onChange={handleInputChange} className="w-20 text-right pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
                      </div>
                    )}
                    <Switch id="stress-test-switch" checked={isStressed} onCheckedChange={setIsStressed} />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">Business Valuation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="sde" className="text-slate-700">SDE</Label><Input id="sde" name="sde" value={inputs.sde} onChange={handleInputChange} /></div>
                    <div className="space-y-2"><Label htmlFor="askingMultiple" className="text-slate-700">Asking Multiple</Label><Input id="askingMultiple" name="askingMultiple" value={inputs.askingMultiple} onChange={handleInputChange} /></div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">Deal Structure</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label htmlFor="ownerSalary" className="text-slate-700">Owner Salary</Label><Input id="ownerSalary" name="ownerSalary" value={inputs.ownerSalary} onChange={handleInputChange} /></div>
                    <div className="space-y-2"><Label htmlFor="closingCosts" className="text-slate-700">Closing Costs</Label><Input id="closingCosts" name="closingCosts" value={inputs.closingCosts} onChange={handleInputChange} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="loanAmount" className="text-slate-700">SBA Loan Amount</Label><Input id="loanAmount" name="loanAmount" value={inputs.loanAmount} onChange={handleInputChange} className={errors.loanAmount ? 'border-red-500' : ''}/>{errors.loanAmount && <p className="text-red-500 text-xs">{errors.loanAmount}</p>}</div>
                
                {isAdvancedView ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="p-6"><h3 className="text-base font-semibold text-slate-800">Seller Financing Details</h3></div>
                    <div className="p-6 pt-0 space-y-4">
                       <div>
                          <Label htmlFor="amortizingSellerNoteAmount" className="text-slate-700">Amortizing Seller Note</Label>
                          <Input id="amortizingSellerNoteAmount" name="amortizingSellerNoteAmount" value={inputs.amortizingSellerNoteAmount} onChange={handleInputChange} className={`mt-2 ${errors.amortizingSellerNoteAmount ? 'border-red-500' : ''}`}/>
                       </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label className="text-slate-700">Term (Yrs)</Label><Input name="amortizingNoteTerm" value={inputs.amortizingNoteTerm} onChange={handleInputChange} /></div>
                            <div className="space-y-2"><Label className="text-slate-700">Rate (%)</Label><Input name="amortizingNoteRate" value={inputs.amortizingNoteRate} onChange={handleInputChange} /></div>
                        </div>
                         <div className="space-y-2">
                           <Label className="text-slate-700">Note Type</Label>
                           <select name="amortizingNoteType" value={inputs.amortizingNoteType} onChange={(e) => handleSelectChange('amortizingNoteType', e.target.value as any)} className="w-full bg-white text-slate-700 border border-slate-300 rounded-md py-2.5 px-3 text-sm transition focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/80">
                                <option value="interestOnly">Interest-Only</option>
                                <option value="amortizing">Amortizing</option>
                           </select>
                         </div>
                        <hr className="border-slate-200" />
                        <div className="flex items-center justify-between pt-2">
                           <Label htmlFor="advanced-notes-toggle" className="text-slate-700">Add Standby / Forgivable Notes</Label>
                           <Switch id="advanced-notes-toggle" checked={showAdvancedSellerNotes} onCheckedChange={setShowAdvancedSellerNotes} />
                        </div>
                        {showAdvancedSellerNotes && (
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                                {/* Standby Note */}
                                <div className="space-y-2"><Label className="text-slate-700">Standby Note Amount</Label><Input name="standbySellerNoteAmount" value={inputs.standbySellerNoteAmount} onChange={handleInputChange} className={errors.standbySellerNoteAmount ? 'border-red-500' : ''}/></div>
                                {/* Forgivable Note */}
                                <div className="space-y-2"><Label className="text-slate-700">Forgivable Note Amount</Label><Input name="forgivableSellerNoteAmount" value={inputs.forgivableSellerNoteAmount} onChange={handleInputChange} className={errors.forgivableSellerNoteAmount ? 'border-red-500' : ''}/></div>
                            </div>
                        )}
                    </div>
                  </div>
                ) : (
                    <div className="space-y-2"><Label htmlFor="amortizingSellerNoteAmount" className="text-slate-700">Seller Note Amount</Label><Input id="amortizingSellerNoteAmount" name="amortizingSellerNoteAmount" value={inputs.amortizingSellerNoteAmount} onChange={handleInputChange} className={errors.amortizingSellerNoteAmount ? 'border-red-500' : ''}/></div>
                )}
            </div>
            
            {isAdvancedView && (
               <div className="space-y-4">
                 <h3 className="text-lg font-semibold text-slate-700 border-b border-slate-200 pb-2">Fine-Tuning Levers</h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-slate-700">SBA Term (Yrs)</Label><Input name="sbaTerm" value={inputs.sbaTerm} onChange={handleInputChange} /></div>
                    <div className="space-y-2"><Label className="text-slate-700">SBA Rate (%)</Label><Input name="sbaRate" value={inputs.sbaRate} onChange={handleInputChange} /></div>
                 </div>
                 <div className="space-y-2"><Label className="text-slate-700">Liquidity (Months of Debt Service)</Label><Input name="liquidityMonths" value={inputs.liquidityMonths} onChange={handleInputChange} /></div>
               </div>
            )}
          </div>

          {/* --- Outputs Column --- */}
          <div className="space-y-4">
            <OutputCard title="Enterprise Value" value={`$${formatCurrency(calculations.enterpriseValue)}`} description="SDE x Asking Multiple" />
            <OutputCard title={isAdvancedView ? "Total Estimated Cash to Close" : "Total Cash to Close"} value={`$${formatCurrency(calculations.totalCashToClose)}`} valueClassName="text-amber-600" description="Your total cash required for the deal." />
            <div className="grid grid-cols-2 gap-4">
                <OutputCard title="DSCR" value={`${calculations.dscr.toFixed(2)}x`} valueClassName={calculations.isDscrLow ? 'text-red-600' : 'text-green-600'} description={isAdvancedView ? "Target > 1.50x" : "Target > 1.25x"} />
                <OutputCard title="Net Cash Flow to Owner" value={`$${formatCurrency(calculations.netCashFlowToOwner)}`} valueClassName={calculations.netCashFlowToOwner < 0 ? 'text-red-600' : 'text-slate-900'} description="Annual cash flow after debt and salary."/>
            </div>
            {isAdvancedView && (
               <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg">
                    <div className="p-6"><h3 className="text-base font-semibold text-slate-800">Financial Breakdown</h3></div>
                    <div className="p-6 pt-0">
                       <ul className="space-y-2 text-sm">
                          <li className="flex justify-between"><span>Buyer Equity:</span> <span className="font-mono">${formatCurrency(calculations.buyerEquity)}</span></li>
                          <li className="flex justify-between"><span>Closing Costs:</span> <span className="font-mono">${formatCurrency(parseCurrency(inputs.closingCosts))}</span></li>
                          <li className="flex justify-between"><span>Liquidity Reserve:</span> <span className="font-mono">${formatCurrency(calculations.liquidityTarget)}</span></li>
                          <hr className="my-2 border-slate-200" />
                          <li className="flex justify-between"><span>Annual Debt Service:</span> <span className="font-mono">${formatCurrency(calculations.totalDebtService)}</span></li>
                          <li className="flex justify-between pl-4 text-slate-500"><span>- SBA Loan:</span> <span className="font-mono">${formatCurrency(calculations.sbaDebtService)}</span></li>
                          <li className="flex justify-between pl-4 text-slate-500"><span>- Seller Note:</span> <span className="font-mono">${formatCurrency(calculations.sellerNoteDebtService)}</span></li>
                       </ul>
                    </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ValuationCalculator;