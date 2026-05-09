import { supabase } from './config';

/**
 * Upload a document/file to Supabase Storage
 * @param fileUri - Local URI of the file
 * @param userId - User ID for organizing files
 * @param mimeType - MIME type of the file
 * @returns Promise<string> - Public URL of the uploaded file
 */
export const uploadToSupabase = async (
  fileUri: string,
  userId: string,
  mimeType: string = 'application/pdf',
  originalFileName?: string
): Promise<string> => {
  try {
    const extension = getExtension(originalFileName, mimeType);
    const safeOriginalName = sanitizeFileName(originalFileName || `document.${extension}`);
    const filename = `${userId}/${Date.now()}_${safeOriginalName}`;
    
    // In React Native, fetch(fileUri).blob() often fails with local files.
    // We must use FormData which works correctly with the native networking layer.
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: safeOriginalName,
      type: mimeType,
    } as any);
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('mindspace-files')
      .upload(filename, formData, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('mindspace-files')
      .getPublicUrl(filename);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
};

/**
 * Upload a PDF document
 */
export const uploadPDFToSupabase = async (
  fileUri: string,
  userId: string
): Promise<string> => {
  return uploadToSupabase(fileUri, userId, 'application/pdf');
};

/**
 * Upload a document (DOCX, TXT, etc.)
 */
export const uploadDocumentToSupabase = async (
  fileUri: string,
  userId: string,
  mimeType: string,
  originalFileName?: string
): Promise<string> => {
  return uploadToSupabase(fileUri, userId, mimeType, originalFileName);
};

/**
 * Delete a file from Supabase Storage
 */
export const deleteFromSupabase = async (fileUrl: string): Promise<void> => {
  try {
    // Extract filename from URL
    const filename = fileUrl.split('/mindspace-files/')[1];
    
    if (!filename) {
      throw new Error('Invalid file URL');
    }
    
    const { error } = await supabase.storage
      .from('mindspace-files')
      .remove([filename]);
    
    if (error) throw error;
    
    console.log('File deleted successfully');
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    throw error;
  }
};

/**
 * List files for a user
 */
export const listUserFiles = async (userId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase.storage
      .from('mindspace-files')
      .list(userId);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

const getExtension = (fileName?: string, mimeType?: string): string => {
  const fileExt = fileName?.split('.').pop()?.toLowerCase();
  if (fileExt && fileExt !== fileName?.toLowerCase()) return fileExt;

  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/zip': 'zip',
  };

  return map[mimeType || ''] || 'pdf';
};

const sanitizeFileName = (name: string): string => {
  const trimmed = name.trim() || 'document.pdf';
  const withoutUnsafeChars = trimmed.replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_');
  return withoutUnsafeChars.includes('.') ? withoutUnsafeChars : `${withoutUnsafeChars}.pdf`;
};
