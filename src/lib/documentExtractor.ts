import { extractTextFromPDF } from './pdfExtractor';

export const extractTextFromDocument = async (file: File): Promise<string> => {
  const fileType = file.type;
  
  if (fileType === 'application/pdf') {
    return extractTextFromPDF(file);
  }
  
  // For Word documents, we'll need to handle them differently
  // For now, we'll just support PDF and show a message for Word docs
  if (fileType === 'application/msword' || 
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    throw new Error('Word document support coming soon. Please use a PDF file.');
  }
  
  throw new Error('Unsupported file type. Please upload a PDF file.');
};