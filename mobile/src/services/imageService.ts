import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { api } from './api';

export type ImageType =
  | 'avatar'           // Profile photos (512x512, 1:1)
  | 'logo'             // Organization logos (512x512, 1:1, PNG for transparency)
  | 'illustration'     // Illustrations for opportunities, communities, spaces (800x600, 4:3, max 5)
  | 'document'         // Documents (max 2000px)
  | 'identity';        // Identity documents (max 1500px, higher quality)

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
    quality: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  },
  logo: {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.9,
    format: ImageManipulator.SaveFormat.PNG, // PNG for logos to preserve transparency
  },
  illustration: {
    maxWidth: 800,
    maxHeight: 600,
    quality: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  },
  document: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  },
  identity: {
    maxWidth: 1500,
    maxHeight: 1500,
    quality: 0.95, // Higher quality for identity documents
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
    Alert.alert(
      'Permission requise',
      'Nous avons besoin de votre permission pour accéder à vos photos.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission requise',
      'Nous avons besoin de votre permission pour accéder à la caméra.',
      [{ text: 'OK' }]
    );
    return false;
  }
  return true;
}

function getAspectRatio(type: ImageType): [number, number] {
  switch (type) {
    case 'avatar':
    case 'logo':
      return [1, 1];
    case 'illustration':
      return [4, 3];
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
    actions.push({
      resize: {
        width: config.maxWidth,
        height: config.maxHeight,
      },
    });

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
    console.error('[ImageService] Error optimizing image:', error);
    throw new Error('Erreur lors de l\'optimisation de l\'image');
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
    console.error('[ImageService] Error picking image:', error);
    Alert.alert(
      'Erreur',
      'Une erreur est survenue lors de la sélection de l\'image.',
      [{ text: 'OK' }]
    );
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
    console.error('[ImageService] Error taking photo:', error);
    Alert.alert(
      'Erreur',
      'Une erreur est survenue lors de la capture de la photo.',
      [{ text: 'OK' }]
    );
    return null;
  }
}

export async function pickOrTakeImage(options: PickImageOptions): Promise<OptimizedImage | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Choisir une image',
      'Comment souhaitez-vous ajouter votre image ?',
      [
        {
          text: 'Prendre une photo',
          onPress: async () => {
            const result = await takePhoto(options);
            resolve(result);
          },
        },
        {
          text: 'Choisir depuis la galerie',
          onPress: async () => {
            const result = await pickImage(options);
            resolve(result);
          },
        },
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ]
    );
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
    const baseUrl = api.getBaseUrl();

    // Use fetch directly for multipart/form-data (Content-Type set automatically with boundary)
    let response = await fetch(`${baseUrl}/api/images/upload`, {
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

        response = await fetch(`${baseUrl}/api/images/upload`, {
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
    console.error('[ImageService] Error uploading image:', error);
    throw new Error(error.message || 'Erreur lors de l\'upload de l\'image');
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
