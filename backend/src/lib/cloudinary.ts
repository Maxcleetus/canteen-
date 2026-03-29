import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

const readEnvVar = (key: string) => {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const configureCloudinary = () => {
  const cloudName = readEnvVar('CLOUDINARY_CLOUD_NAME');
  const apiKey = readEnvVar('CLOUDINARY_API_KEY');
  const apiSecret = readEnvVar('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });

  return {
    cloudName,
    apiKey,
    apiSecret
  };
};

export const isCloudinaryConfigured = () => configureCloudinary() !== null;

export const uploadDishImage = async (
  file: Express.Multer.File
): Promise<UploadApiResponse> => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured');
  }

  const uploadFolder = readEnvVar('CLOUDINARY_DISHES_FOLDER') ?? 'canteen-management/dishes';
  const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

  return cloudinary.uploader.upload(dataUri, {
    folder: uploadFolder,
    resource_type: 'image'
  });
};
