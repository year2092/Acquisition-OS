// src/utils/markdownRenderer.ts

const processMarkdownTable = (markdown: string): string => {
    const lines = markdown.trim().split('\n').filter(line => line.trim() !== '' && line.trim().match(/\|/));
    if (lines.length < 2) return markdown;

    const headerLine = lines[0];
    const separatorLine = lines[1];
    
    if (!separatorLine.match(/\|(?:\s*:?-+:?\s*\|)+/)) return markdown;
    
    const bodyLines = lines.slice(2);

    const headerCells = headerLine.split('|').slice(1, -1).map(cell =>
        `<th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">${cell.trim()}</th>`
    ).join('');

    const bodyRows = bodyLines.map(rowLine => {
        const cells = rowLine.split('|').slice(1, -1);
        if (cells.length === 0) return '';
        const rowHtml = cells.map((cell, index) => {
            let content = cell.trim()
              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>');

            let tdClasses = "px-6 py-4 text-sm text-slate-700 align-top";
            let cellContent = content;

            if (index === 0) tdClasses += " font-medium text-slate-800";
            if (index === 2 && (headerCells.toLowerCase().includes('fit'))) {
                tdClasses += " text-center";
                
                const textContentForLogic = content.replace(/<[^>]+>/g, '');
                const cleanContent = textContentForLogic.toLowerCase();

                if (cleanContent === 'yes') cellContent = `<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">${content}</span>`;
                else if (cleanContent === 'no') cellContent = `<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">${content}</span>`;
                else cellContent = `<span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-200 text-slate-700">${content}</span>`;
            }
            if (index === 3 && (headerCells.toLowerCase().includes('rationale'))) tdClasses += ' whitespace-normal';
            return `<td class="${tdClasses}">${cellContent}</td>`;
        }).join('');
        return `<tr class="hover:bg-slate-50">${rowHtml}</tr>`;
    }).join('');

    return `
        <div class="align-middle inline-block min-w-full">
            <div class="shadow overflow-hidden border border-slate-200 sm:rounded-lg">
                <table class="min-w-full divide-y divide-slate-200">
                    <thead class="bg-slate-100">
                        <tr>${headerCells}</tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-slate-200">
                        ${bodyRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

export const renderMarkdown = (text: string | null | undefined): { __html: string } => {
    if (!text) return { __html: '' };

    let processedText = text;

    const tableRegex = /(?:^|\n)(\|.*\|.*\r?\n\|.*-.*\|(?:.*\r?\n?)*)/g;
    
    const tables: string[] = [];
    processedText = processedText.replace(tableRegex, (tableMarkdown) => {
        tables.push(processMarkdownTable(tableMarkdown.trim()));
        return '%%TABLE_PLACEHOLDER%%';
    });
    
    // Process list blocks before other replacements
    processedText = processedText.replace(/(?:^\s*[*-]\s.*(?:\r?\n|$))+/gm, (match) => {
        const items = match.trim().split('\n').map(item => {
            return `<li class="mb-1 text-slate-700">${item.replace(/^\s*[*-]\s/, '').trim()}</li>`;
        }).join('');
        return `%%LIST_START%%${items}%%LIST_END%%`;
    });

    let html = processedText
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2 text-slate-800">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 text-slate-800">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4 text-slate-800">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
        .replace(/`---`|`___`/g, '<hr class="my-4 border-slate-200">')
        .replace(/%%LIST_START%%/g, '<ul class="list-disc pl-5 mb-4">')
        .replace(/%%LIST_END%%/g, '</ul>')
        .replace(/\n/g, '<br />');

    // Clean up extra line breaks around block elements
    html = html.replace(/<br \/>\s*(<(?:ul|h[1-3]|div|hr)[^>]*>)/g, '$1');
    html = html.replace(/(<\/(?:ul|h[1-3]|div|hr)>)\s*<br \/>/g, '$1');
    
    tables.forEach(tableHtml => {
        html = html.replace('%%TABLE_PLACEHOLDER%%', tableHtml);
    });

    return { __html: html };
};