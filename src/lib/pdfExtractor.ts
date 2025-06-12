import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker using Vite's asset handling
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items with appropriate spacing
      const pageText = textContent.items
        .map((item: any) => {
          // Handle different types of text items
          if (typeof item === 'object' && item.str) {
            return item.str;
          }
          return '';
        })
        .filter(str => str.trim().length > 0)
        .join(' ')
        .replace(/\s+/g, ' ') // Clean up multiple spaces
        .trim();
      
      if (pageText) {
        fullText += pageText + '\n\n';
      }
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF. Please copy and paste your resume text manually.');
  }
};