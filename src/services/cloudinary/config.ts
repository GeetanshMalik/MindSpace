const requiredEnv = (name: string, value?: string) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const cloudName = requiredEnv(
  'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME',
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
);

export const CLOUDINARY_CONFIG = {
  cloudName,
  uploadPreset: requiredEnv(
    'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET',
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  ),
  apiUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
};
