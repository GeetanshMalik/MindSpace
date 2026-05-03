// Updated to use Cloudinary instead of Firebase Storage
// Firebase Storage had setup issues, so we're using Cloudinary (25GB free)

import { CLOUDINARY_CONFIG } from '../cloudinary/config';

// Size limits in MB
export const MEDIA_LIMITS = {
  image: 10,       // 10MB per image
  video: 100,      // 100MB (Cloudinary supports larger videos)
  audio: 100,      // 100MB
  document: 100,   // 100MB
  maxImages: 10,   // max 10 images per message
};

/**
 * Get file size from a local URI.
 */
const getFileSize = async (uri: string): Promise<number> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return 0;
  }
};

/**
 * Upload a media file to Cloudinary.
 * @param uri Local file URI (from ImagePicker etc.)
 * @param storagePath Path for organization (folder/filename)
 * @param mediaType Type of media for size validation
 * @returns Download URL string
 * @throws Error if file exceeds size limit
 */
export const uploadMedia = async (
  uri: string,
  storagePath: string,
  mediaType: 'image' | 'video' | 'audio' | 'document' = 'image'
): Promise<string> => {
  // Validate size
  const sizeBytes = await getFileSize(uri);
  const sizeMB = sizeBytes / (1024 * 1024);
  const limitMB = MEDIA_LIMITS[mediaType];

  if (sizeMB > limitMB) {
    throw new Error(`File too large (${sizeMB.toFixed(1)}MB). Max ${limitMB}MB for ${mediaType}.`);
  }

  try {
    const formData = new FormData();
    
    // Determine resource type and MIME type
    const extension = getExtensionFromUri(uri);
    let resourceType: 'image' | 'video' | 'raw' = 'image';
    let mimeType = 'image/jpeg';
    
    if (mediaType === 'video') {
      resourceType = 'video';
      mimeType = 'video/mp4';
    } else if (mediaType === 'audio') {
      resourceType = 'video'; // Cloudinary uses 'video' for audio
      mimeType = 'audio/mpeg';
    } else if (mediaType === 'document') {
      resourceType = 'raw';
      mimeType = 'application/pdf';
    }
    
    // Prepare file for upload
    formData.append('file', {
      uri,
      type: mimeType,
      name: `upload.${extension}`,
    } as any);
    
    // Add upload preset
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    
    // Add folder for organization (extract from storagePath)
    const folder = storagePath.split('/')[0];
    formData.append('folder', `mindspace/${folder}`);
    
    // Note: Cloudinary unsigned uploads don't support transformation params.
    // Video compression relies on the 30s duration cap + picker quality settings.
    
    // Build API URL based on resource type
    const apiUrl = CLOUDINARY_CONFIG.apiUrl.replace('/image/', `/${resourceType}/`);
    
    // Upload to Cloudinary
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Return the secure URL
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
};

/**
 * Generate a unique storage path for a media file.
 */
export const getMediaPath = (
  folder: string,
  userId: string,
  extension: string = 'jpg'
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${folder}/${userId}/${timestamp}_${random}.${extension}`;
};

/**
 * Get file extension from URI.
 */
export const getExtensionFromUri = (uri: string): string => {
  const match = uri.match(/\.(\w+)(\?.*)?$/);
  return match ? match[1].toLowerCase() : 'jpg';
};
