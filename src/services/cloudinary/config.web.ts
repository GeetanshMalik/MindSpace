const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dueuxwkzq';

export const CLOUDINARY_CONFIG = {
  cloudName,
  uploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'mindspace',
  apiUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
};
