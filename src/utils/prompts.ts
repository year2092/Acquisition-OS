import { BuyBoxCriteria } from '../App';

// A record of detailed instructions for each analysis aspect, moved from CompanyProfiler
const detailedPromptInstructions: Record<string, string> = {
    businessModel: `* **Business Model:** Detailed breakdown of how the company creates, delivers, and captures value. Revenue streams (e.g., product sales, services, subscriptions), key activities, value proposition.`,
    productsServices: `* **Products/Services:** Comprehensive list and description of major offerings. Target use cases or customer problems solved. Any unique features mentioned.`,
    targetMarketCustomerBase: `* **Target Market & Customer Base:** Define the primary industry/vertical. Describe the ideal customer profile(s). Mention key segments served, geographic focus, and any available info on customer relationships or retention (e.g., from case studies, testimonials).`,
    financialHealth: `* **Financial Health:** Infer financial scale if possible (e.g., mentions of funding rounds, # of employees, office size, pricing tiers). Note any public financial data or commentary found (e.g., for public companies or from news articles). State limitations clearly if financials are private. **Specifically include a line for 'Reported SDE/Cash Flow: $VALUE' if a specific figure is available in the source.**`,
    marketPosition: `* **Market Position:** Assess the company's perceived position in its market (e.g., leader, challenger, niche player). Identify key differentiators, brand perception (based on language, reviews if accessible), and apparent market share if inferable.`,
    competitiveLandscape: `* **Competitive Landscape:** Identify 2-3 key direct or indirect competitors based on the company's offerings and market. Briefly describe their positioning relative to the target company.`,
    managementTeamOrg: `* **Management Team & Org:** Identify key executives mentioned. Infer organizational complexity based on available information (e.g., 'About Us' page, LinkedIn data if accessible). Note if leadership seems heavily involved or if a broader team structure is apparent.`,
    operationsScalability: `* **Operations & Scalability:** Describe the operational model (e.g., manufacturing, service delivery, SaaS platform). Note if asset-light/heavy. Mention any technology stack details or infrastructure discussed. Comment on apparent potential for scaling based on the model.`,
    technologyIp: `* **Technology & IP:** Detail any specific technologies, platforms, patents, or proprietary processes highlighted by the company.`,
    supplyChainPartners: `* **Supply Chain / Key Partners:** List any significant suppliers, distributors, or strategic partners mentioned. Assess potential dependencies.`,
    regulatoryCompliance: `* **Regulatory/Compliance:** Note any industry-specific regulations, certifications, or compliance standards mentioned or clearly applicable.`,
    growthOpportunities: `* **Growth Opportunities:** Based on the analysis, identify 1-2 potential growth levers (e.g., geographic expansion, new product launch, improved marketing, M&A potential).`,
};

/**
 * Generates the prompt for the Company Profiler component.
 */
export const getProfilerPrompt = (url: string, analysisAspects: Record<string, boolean>, correctionInput?: string): string => {
    let part2Prompt = `**Part 2: Detailed Company Profile**
Analyze the source (URL/Document) thoroughly and generate an institutional-level preliminary profile. For each selected focus area below, provide a comprehensive and expansive analysis. Go into significant detail, aiming for at least 2-3 detailed paragraphs per section. Elaborate on each point with evidence, examples, or inferences from the source material. The goal is a thorough, in-depth report, not a brief summary. Structure the response using Markdown headings for *each* of the selected focus areas. If information for a selected area cannot be found, explicitly state "Information not readily available from public sources."

**CRITICAL FORMATTING RULE:** You *must* add a blank newline (an extra line break) after *every* Markdown heading (e.g., \`### Company Overview\`) before starting the text, list, or bullet points for that section.

* **Company Overview:** (Always include) Name, HQ Location, Year Founded (if available), brief mission/vision statement.`;

    (Object.keys(analysisAspects) as Array<keyof typeof analysisAspects>).forEach(key => {
        if (analysisAspects[key] && detailedPromptInstructions[key]) {
            part2Prompt += `\n${detailedPromptInstructions[key]}`;
        }
    });

    part2Prompt += `\n\n* **Sources:** (Always include) List the primary URLs or document sections used for the analysis.`;

    const originalPrompt = `
You are an M&A analyst. Your task is to analyze a target company based on the provided URL, enriching your analysis with external data.

**Data Enrichment Steps (Perform BEFORE Generating Report):**

1.  **Identify Company Type:** Determine if the target company at ${url} appears to be publicly traded in the US.
2.  **IF PUBLIC:**
    *   Use your search tool to find the company's **most recent Form 10-K** from the SEC EDGAR database or reputable financial sites.
    *   If found, briefly review the "Business Overview," "Management's Discussion and Analysis (MD&A)," and "Risk Factors" sections. **Prioritize using information from the 10-K** in the profile below, especially for Financial Health, Market Position, Competition, and Risks.
3.  **IF PRIVATE (or 10-K not found/applicable):**
    *   Use your search tool to find publicly available, recent (last 1-2 years) industry analysis, market research summaries, or reputable news articles related to the company's primary industry.
    *   Focus on findi
ng data about **market size, growth trends, key competitors, and common industry challenges.**
    *   Incorporate these findings into the profile below, citing the source type (e.g., "Industry news suggests...", "Market summaries indicate...").

**Your Task: Generate a Company Analysis Report**

Based on your data enrichment findings, generate a report with the following two sections, precisely in this order, separated by "---[SPLIT]---".

**Part 1: Key Insights & Potential Red Flags (General)**
*   Incorporate insights derived from the 10-K (especially Risk Factors) or industry analysis.
*   Generate 3-5 bullet points highlighting general strengths, weaknesses, opportunities, or potential business risks.
*   Do NOT reference any user-specific acquisition criteria.

---[SPLIT]---

${part2Prompt}
`;

    if (correctionInput && correctionInput.trim()) {
        return `A user has provided the following correction to the previous analysis. Please prioritize this feedback, re-evaluate all sources, and generate a new, corrected report based on the original instructions.

User Correction: "${correctionInput.trim()}"

---

Original Instructions:
${originalPrompt}`;
    }

    return originalPrompt;
};

/**
 * Generates the prompt for finding business listings based on Buy Box criteria.
 */
export const getSourcingSearchPrompt = (industries: string, geographies: string, buyBox: BuyBoxCriteria): string => {
    return `
You are an expert M&A sourcing analyst. Based on the following Buy Box criteria, search online marketplaces (like BizBuySell, Website Closers, Dealflow, etc.) and broker websites to find businesses for sale.

**Buy Box Criteria:**
*   **Industries:** ${industries}
*   **Geographies:** ${geographies}
*   **SDE/Cash Flow Range:** $${buyBox.minSde.value.toLocaleString()} - $${buyBox.maxSde.value.toLocaleString()}

**Your Task:**
1.  Identify up to 10 unique listings that are the best match for the criteria.
2.  Return your findings as a single, valid JSON array of objects inside a JSON markdown block. Each object must have "title" and "url" properties. The URL must be a direct link to the listing page.
3.  **Important:** Do not include any text, explanation, or notes before or after the JSON markdown block.

**Example Response Format:**
\`\`\`json
[
  {
    "title": "Profitable HVAC Business in Texas",
    "url": "https://www.bizbuysell.com/Business-Opportunity/profitable-hvac-business-in-booming-texas-market/12345"
  }
]
\`\`\`

If you cannot find any listings, return an empty JSON array \`[]\` inside the markdown block.
`;
};


/**
 * Generates the comprehensive analysis prompt for the Sourcing Engine.
 */
export const getSourcingAnalysisPrompt = (url: string, buyBox: BuyBoxCriteria): string => {
    const growthLeversText = Object.entries(buyBox.growthLevers)
        .filter(([key, value]) => key !== 'weight' && value)
        .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
        .join(', ') || 'Not specified';

    const industryExpertiseText = buyBox.industryExpertise.length > 0
        ? buyBox.industryExpertise.map(e => `${e.industry} (${e.proficiency})`).join(', ')
        : 'Not specified';

    return `
You are an M&A analyst. Your task is to perform a comprehensive analysis of a target company from a business-for-sale listing found at the URL: ${url}. You will structure your response into exactly three parts, separated by a unique delimiter.

**CRITICAL INSTRUCTION:** For Parts 1 and 2, derive all information *directly* from the content of the provided URL. Your analysis in these parts must be an objective reflection of the listing. **DO NOT** allow the user's Buy Box criteria (provided for Part 3) to influence your objective analysis in Parts 1 and 2.

---

**PART 1: KEY INSIGHTS & RED FLAGS**
*   Based on the listing at the URL, generate 3-5 bullet points highlighting the most critical general strengths, weaknesses, opportunities, or potential business risks.
*   Do NOT reference the user's specific acquisition criteria in this section. This is a general overview of the deal as presented.

---[SPLIT]---

**PART 2: DETAILED COMPANY PROFILE**
*   Analyze the source URL thoroughly and generate an institutional-level preliminary profile. Provide a comprehensive and expansive analysis for each section below. Structure the response using Markdown headings. If information for a section cannot be found, explicitly state "Information not readily available."
*   **CRITICAL FORMATTING RULE:** You *must* add a blank newline (an extra line break) after *every* Markdown heading (e.g., \`### Company Overview\`) before starting the text.

    *   ### Company Overview
        First, carefully extract the following key details from the listing page. Prioritize the most prominent "headline" numbers and descriptions. Each bullet point must start with a bolded label:
        *   **Listing Title:** [The full title or headline of the business for sale listing.]
        *   **Primary Industry:** [Determine the specific industry from the title and description. E.g., "SaaS Payment Platform", "Landscaping Services", "E-commerce". Avoid overly broad categories if specific information is available.]
        *   **Location:** [Headquarters Location, if mentioned.]
        *   **Year Founded:** [Year Founded, if available.]
        *   **Asking Price:** [Extract the asking price. If not available, state "Not Disclosed".]
        *   **Revenue:** [Extract the reported gross revenue. Specify if it is TTM or for a specific year.]
        *   **SDE/Cash Flow/Income:** [Extract the primary profitability metric shown, such as SDE, Adjusted EBITDA, Seller's Discretionary Earnings, Cash Flow, or Income. Label it with the term used in the listing.]
        After these bullet points, provide a concise summary paragraph of the business based on the listing's description.

    *   ### Business Model
        How the company creates, delivers, and captures value.
    *   ### Products/Services
        Comprehensive list and description of major offerings.
    *   ### Target Market & Customer Base
        Primary industry, ideal customer profile, key segments.
    *   ### Market Position & Competition
        Perceived market position, key differentiators, and 2-3 key competitors.
    *   ### Financial Health
        Infer financial scale (e.g., from revenue claims, employee count, pricing).
    *   ### Management Team & Operations
        Key personnel, organizational complexity, operational model (asset-light/heavy).
    *   ### Growth Opportunities
        Identify 1-2 potential growth levers mentioned in the listing.

---[SPLIT]---

**PART 3: BUY BOX FIT SCORECARD**
*   Score the target company (which you analyzed in Part 2) against the user's "Buy Box" criteria below.
*   Present this as a Markdown table with four columns: "Criteria", "Target's Status", "Fit (Yes/No/?)", and "Rationale".
*   **IMPORTANT:** Base "Target's Status" on the objective information you gathered in Part 2. If information is not available, mark Status as "Unknown", Fit as "?", and state in the Rationale that the information was not in the listing.

*   **Correct Markdown Table Example:**
| Criteria | Target's Status | Fit (Yes/No/?) | Rationale |
| :--- | :--- | :--- | :--- |
| Geography (Weight: 2) | Houston, Texas | Yes | The company is in a user-specified geography. |
| Industry (Weight: 3) | B2B Facility Services | No | The target is a SaaS company, which does not match the user's specified industry. |


**User's Buy Box Criteria (with priority weight):**
*   **Geography (Weight: ${buyBox.geography.weight}):** ${buyBox.geography.value || 'Not specified'}
*   **Industry (Weight: ${buyBox.industryType.weight}):** ${buyBox.industryType.value || 'Not specified'}
*   **Industry Expertise:** ${industryExpertiseText}
*   **Financials (SDE) (Weight: ${buyBox.minSde.weight}):** $${buyBox.minSde.value.toLocaleString()} - $${buyBox.maxSde.value.toLocaleString()}
*   **Revenue Quality (Weight: ${buyBox.minRecurringRevenue.weight}):** Min. ${buyBox.minRecurringRevenue.value}% recurring
*   **Risk (Concentration) (Weight: ${buyBox.customerConcentration.weight}):** Max. ${buyBox.customerConcentration.value}% from a single customer
*   **Growth Levers (Weight: ${buyBox.growthLevers.weight}):** ${growthLeversText}
*   **Industry Trends (Weight: ${buyBox.industryTrends.weight}):** ${buyBox.industryTrends.value || 'Not specified'}
*   **Seller Role (Weight: ${buyBox.sellerRole.weight}):** ${buyBox.sellerRole.value || 'Not specified'}
*   **Team Strength (Weight: ${buyBox.teamStrength.weight}):** ${buyBox.teamStrength.value || 'Not specified'}
*   **Business Model (Weight: ${buyBox.businessModel.weight}):** ${buyBox.businessModel.value || 'Not specified'}
*   **Systems (Weight: ${buyBox.systemMessiness.weight}):** ${buyBox.systemMessiness.value} (1=Messy, 5=Clean)
*   **My Role (Weight: ${buyBox.myPrimaryRole.weight}):** ${buyBox.myPrimaryRole.value || 'Not specified'}
*   **Culture:** ${buyBox.desiredCulture || 'Not specified'}
`;
};