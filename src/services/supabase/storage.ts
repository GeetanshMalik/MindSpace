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
  mimeType: string = 'application/pdf'
): Promise<string> => {
  try {
    // Generate unique filename
    const extension = mimeType.split('/')[1] || 'pdf';
    const filename = `${userId}/${Date.now()}.${extension}`;
    
    // Convert URI to blob
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    // Upload to Supabase
    const { data, error } = await supabase.storage
      .from('mindspace-files')
      .upload(filename, blob, {
        contentType: mimeType,
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
  mimeType: string
): Promise<string> => {
  return uploadToSupabase(fileUri, userId, mimeType);
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
