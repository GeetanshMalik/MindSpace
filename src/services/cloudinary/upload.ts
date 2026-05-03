import { CLOUDINARY_CONFIG } from './config';

type FileType = 'image' | 'video' | 'audio' | 'raw';

/**
 * Upload a file to Cloudinary
 * @param fileUri - Local URI of the file to upload
 * @param fileType - Type of file (image, video, audio, raw)
 * @param mimeType - MIME type of the file (e.g., 'image/jpeg', 'video/mp4')
 * @returns Promise<string> - URL of the uploaded file
 */
export const uploadToCloudinary = async (
  fileUri: string,
  fileType: FileType = 'image',
  mimeType: string = 'image/jpeg'
): Promise<string> => {
  try {
    const formData = new FormData();
    
    // Determine file extension from MIME type
    const extension = mimeType.split('/')[1] || 'jpg';
    
    // Prepare the file for upload
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: `upload.${extension}`,
    } as any);
    
    // Add upload preset (must be unsigned)
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    
    // Set resource type based on file type
    formData.append('resource_type', fileType === 'raw' ? 'raw' : fileType);
    
    // Build API URL based on file type
    const apiUrl = CLOUDINARY_CONFIG.apiUrl.replace('/image/', `/${fileType}/`);
    
    // Upload to Cloudinary
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Return the secure URL of the uploaded file
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

/**
 * Upload an image to Cloudinary
 * @param imageUri - Local URI of the image to upload
 * @returns Promise<string> - URL of the uploaded image
 */
export const uploadImageToCloudinary = async (imageUri: string): Promise<string> => {
  return uploadToCloudinary(imageUri, 'image', 'image/jpeg');
};

/**
 * Upload a video to Cloudinary
 * @param videoUri - Local URI of the video to upload
 * @returns Promise<string> - URL of the uploaded video
 */
export const uploadVideoToCloudinary = async (videoUri: string): Promise<string> => {
  return uploadToCloudinary(videoUri, 'video', 'video/mp4');
};

/**
 * Upload an audio file to Cloudinary
 * @param audioUri - Local URI of the audio to upload
 * @returns Promise<string> - URL of the uploaded audio
 */
export const uploadAudioToCloudinary = async (audioUri: string): Promise<string> => {
  return uploadToCloudinary(audioUri, 'video', 'audio/mpeg'); // Cloudinary uses 'video' for audio
};

/**
 * Upload a document/raw file to Cloudinary
 * @param fileUri - Local URI of the file to upload
 * @param mimeType - MIME type (e.g., 'application/pdf')
 * @returns Promise<string> - URL of the uploaded file
 */
export const uploadDocumentToCloudinary = async (
  fileUri: string,
  mimeType: string = 'application/pdf'
): Promise<string> => {
  return uploadToCloudinary(fileUri, 'raw', mimeType);
};

/**
 * Upload multiple files to Cloudinary
 * @param files - Array of {uri, type, mimeType}
 * @returns Promise<string[]> - Array of uploaded file URLs
 */
export const uploadMultipleFiles = async (
  files: Array<{ uri: string; type: FileType; mimeType: string }>
): Promise<string[]> => {
  const uploadPromises = files.map(file => 
    uploadToCloudinary(file.uri, file.type, file.mimeType)
  );
  return Promise.all(uploadPromises);
};

/**
 * Upload multiple images to Cloudinary
 * @param imageUris - Array of local URIs
 * @returns Promise<string[]> - Array of uploaded image URLs
 */
export const uploadMultipleImages = async (imageUris: string[]): Promise<string[]> => {
  const uploadPromises = imageUris.map(uri => uploadImageToCloudinary(uri));
  return Promise.all(uploadPromises);
};

/**
 * Delete a file from Cloudinary (requires signed request)
 * For now, we'll just remove the reference from Firestore
 * Actual deletion requires backend implementation
 */
export const deleteFromCloudinary = async (fileUrl: string): Promise<void> => {
  // Note: Deleting from Cloudinary requires authentication
  // For free tier, you can just remove the reference from your database
  // Files will be automatically cleaned up by Cloudinary after some time
  console.log('File reference removed:', fileUrl);
};
