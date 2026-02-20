import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { api } from './api';
import i18n from '../i18n';
import { alertsGlobal } from '../contexts/AlertContext';

export type ImageType =
  | 'avatar'           // Profile photos (512x512, 1:1, 80% quality)
  | 'logo'             // Organization logos (512x512, 1:1, PNG, 80% quality)
  | 'illustration'     // Illustrations for opportunities, communities, spaces (1200x900, 80% quality)
  | 'document'         // Talent documents (max 2000px, full quality - no compression)
  | 'identity'         // Identity documents (max 1500px, 95% quality)
  | 'attachment';      // Copilot attachments (max 2000px, full quality - no compression)

interface ImageConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;  // 0-1 scale
  format: ImageManipulator.SaveFormat;
}

const IMAGE_CONFIGS: Record<ImageType, ImageConfig> = {
  avatar: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.8, // 80% quality for avatars
    format: ImageManipulator.SaveFormat.JPEG,
  },
  logo: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.8, // 80% quality for logos
    format: ImageManipulator.SaveFormat.PNG, // PNG for logos to preserve transparency
  },
  illustration: {
    maxWidth: 1200,
    maxHeight: 900,
    quality: 0.8, // 80% quality for illustrations
    format: ImageManipulator.SaveFormat.JPEG,
  },
  document: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 1.0, // Full quality for documents (no compression)
    format: ImageManipulator.SaveFormat.JPEG,
  },
  identity: {
    maxWidth: 1500,
    maxHeight: 1500,
    quality: 0.95, // Higher quality for identity documents
    format: ImageManipulator.SaveFormat.JPEG,
  },
  attachment: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 1.0, // Full quality for copilot attachments (no compression)
    format: ImageManipulator.SaveFormat.JPEG,
  },
};

export interface OptimizedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  fileSize?: number;
}

export interface UploadedImage {
  url: string;
  publicUrl: string;
  fileId: string;
}

export interface PickImageOptions {
  type: ImageType;
  allowsEditing?: boolean;
  aspect?: [number, number];
  includeBase64?: boolean;
}

export async function requestImagePermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    void alertsGlobal.alert(i18n.t('imageService.permissionRequired'), i18n.t('imageService.photoPermission'));
    return false;
  }
  return true;
}

export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    void alertsGlobal.alert(i18n.t('imageService.permissionRequired'), i18n.t('imageService.cameraPermission'));
    return false;
  }
  return true;
}

function getAspectRatio(type: ImageType): [number, number] | undefined {
  switch (type) {
    case 'avatar':
    case 'logo':
      return [1, 1];
    case 'illustration':
      return [4, 3];
    case 'document':
    case 'identity':
    case 'attachment':
      return undefined; // No aspect ratio constraint for documents
    default:
      return [4, 3];
  }
}

export async function optimizeImage(
  uri: string,
  type: ImageType,
  includeBase64: boolean = false
): Promise<OptimizedImage> {
  const config = IMAGE_CONFIGS[type];

  try {
    const actions: ImageManipulator.Action[] = [];

    // For square types (avatar, logo), the ImagePicker's crop with aspect [1,1]
    // already makes the image square. We only need to resize by width to maintain ratio.
    // For other types, resize by width only to preserve aspect ratio.
    // The image will be scaled down proportionally.
    if (type === 'avatar' || type === 'logo') {
      // Square images: resize to exact dimensions (image is already cropped square by picker)
      actions.push({
        resize: {
          width: config.maxWidth,
        },
      });
    } else {
      // Non-square images: resize by width only to preserve aspect ratio
      // If the image is portrait (taller than wide), we should resize by height instead
      // But since we can't know dimensions here without reading the image first,
      // we resize by width which works for most landscape/square images
      actions.push({
        resize: {
          width: config.maxWidth,
        },
      });
    }

    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      {
        compress: config.quality,
        format: config.format,
        base64: includeBase64,
      }
    );

    // Calculate approximate file size (base64 length / 1.37 gives approximate bytes)
    let fileSize: number | undefined;
    if (result.base64) {
      fileSize = Math.round(result.base64.length / 1.37);
    }

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      base64: result.base64,
      fileSize,
    };
  } catch (error) {
    if (__DEV__) console.error('[ImageService] Error optimizing image:', error);
    throw new Error(i18n.t('imageService.optimizeError'));
  }
}

export async function pickImage(options: PickImageOptions): Promise<OptimizedImage | null> {
  const { type, allowsEditing = true, aspect, includeBase64 = false } = options;

  const hasPermission = await requestImagePermissions();
  if (!hasPermission) {
    return null;
  }

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect: aspect || getAspectRatio(type),
      quality: 1, // Get full quality, we'll optimize after
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    return await optimizeImage(asset.uri, type, includeBase64);
  } catch (error) {
    if (__DEV__) console.error('[ImageService] Error picking image:', error);
    void alertsGlobal.error(i18n.t('common.error'), i18n.t('imageService.pickError'));
    return null;
  }
}

export async function takePhoto(options: PickImageOptions): Promise<OptimizedImage | null> {
  const { type, allowsEditing = true, aspect, includeBase64 = false } = options;

  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) {
    return null;
  }

  try {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing,
      aspect: aspect || getAspectRatio(type),
      quality: 1, // Get full quality, we'll optimize after
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];

    return await optimizeImage(asset.uri, type, includeBase64);
  } catch (error) {
    if (__DEV__) console.error('[ImageService] Error taking photo:', error);
    void alertsGlobal.error(i18n.t('common.error'), i18n.t('imageService.captureError'));
    return null;
  }
}

export async function pickOrTakeImage(options: PickImageOptions): Promise<OptimizedImage | null> {
  return new Promise((resolve) => {
    void alertsGlobal.showAlert({
      title: i18n.t('imageService.chooseImage'),
      message: i18n.t('imageService.chooseImageMessage'),
      buttons: [
        {
          text: i18n.t('imageService.takePhoto'),
          onPress: async () => {
            const result = await takePhoto(options);
            resolve(result);
          },
        },
        {
          text: i18n.t('imageService.fromGallery'),
          onPress: async () => {
            const result = await pickImage(options);
            resolve(result);
          },
        },
        {
          text: i18n.t('common.cancel'),
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ],
    });
  });
}

export async function uploadImage(
  image: OptimizedImage,
  type: ImageType,
  category: string = 'general'
): Promise<UploadedImage> {
  try {
    const config = IMAGE_CONFIGS[type];
    const extension = config.format === ImageManipulator.SaveFormat.PNG ? 'png' : 'jpg';
    const mimeType = config.format === ImageManipulator.SaveFormat.PNG ? 'image/png' : 'image/jpeg';
    const filename = `${type}_${Date.now()}.${extension}`;

    const formData = new FormData();
    formData.append('file', {
      uri: image.uri,
      type: mimeType,
      name: filename,
    } as any);
    formData.append('category', category);
    formData.append('image_type', type);

    let token = await api.getToken();
    const { getApiUrl } = await import('../constants/config');

    // Use fetch directly for multipart/form-data (Content-Type set automatically with boundary)
    let response = await fetch(getApiUrl('/images/upload'), {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (response.status === 401) {
      token = await api.tryRefreshToken();
      if (token) {
        // FormData can only be read once, so recreate for retry
        const retryFormData = new FormData();
        retryFormData.append('file', {
          uri: image.uri,
          type: mimeType,
          name: filename,
        } as any);
        retryFormData.append('category', category);
        retryFormData.append('image_type', type);

        response = await fetch(getApiUrl('/images/upload'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: retryFormData,
        });
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.data?.url) {
      throw new Error('Invalid upload response');
    }

    // Return relative URL for storage (e.g., /uploads/illustrations/xxx.jpg)
    // The getFullImageUrl utility should be used when displaying images
    const relativeUrl = data.data.url;


    return {
      url: relativeUrl,
      publicUrl: relativeUrl,
      fileId: data.data.file_id,
    };
  } catch (error: any) {
    if (__DEV__) console.error('[ImageService] Error uploading image:', error);
    throw new Error(error.message || i18n.t('imageService.uploadError'));
  }
}

export async function pickAndUploadImage(
  type: ImageType,
  category: string = 'general',
  options?: Partial<PickImageOptions>
): Promise<UploadedImage | null> {
  const image = await pickImage({ type, ...options });
  if (!image) {
    return null;
  }

  return await uploadImage(image, type, category);
}

export async function takeAndUploadPhoto(
  type: ImageType,
  category: string = 'general',
  options?: Partial<PickImageOptions>
): Promise<UploadedImage | null> {
  const image = await takePhoto({ type, ...options });
  if (!image) {
    return null;
  }

  return await uploadImage(image, type, category);
}

export const imageService = {
  optimizeImage,
  pickImage,
  takePhoto,
  pickOrTakeImage,
  uploadImage,
  pickAndUploadImage,
  takeAndUploadPhoto,
  requestImagePermissions,
  requestCameraPermissions,
  IMAGE_CONFIGS,
};

export default imageService;
