import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';

interface DownloadDocumentInput {
  url: string;
  filename?: string;
  mimeType?: string;
}

const DEFAULT_MIME_TYPE = 'application/pdf';

const sanitizeFilename = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 120);

const ensureAbsoluteUrl = (value: string): string =>
  value.startsWith('http') ? value : `${API_CONFIG.BASE_URL}${value}`;

const guessFilenameFromUrl = (url: string): string => {
  const base = url.split('/').pop()?.split('?')[0] || 'document.pdf';
  return sanitizeFilename(base);
};

const appendExtensionIfMissing = (name: string, mimeType: string): string => {
  if (name.includes('.')) return name;
  if (mimeType === 'application/pdf') return `${name}.pdf`;
  if (mimeType === 'text/csv') return `${name}.csv`;
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return `${name}.docx`;
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return `${name}.xlsx`;
  if (mimeType === 'text/plain') return `${name}.txt`;
  return name;
};

const openRemoteDocument = async (url: string): Promise<boolean> => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
  } catch {
    // Browser fallback below
  }

  try {
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch {
    return false;
  }
};

export async function downloadAndOpenDocument({
  url,
  filename,
  mimeType = DEFAULT_MIME_TYPE,
}: DownloadDocumentInput): Promise<void> {
  const absoluteUrl = ensureAbsoluteUrl(url);
  const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const inferredFilename = appendExtensionIfMissing(
    sanitizeFilename(filename || guessFilenameFromUrl(absoluteUrl)),
    mimeType
  );
  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const localUri = `${cacheDir}${Date.now()}_${inferredFilename}`;

  try {
    const { uri } = await FileSystem.downloadAsync(absoluteUrl, localUri, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType,
        UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
        dialogTitle: 'Partager le document',
      });
      return;
    }

    if (await openRemoteDocument(uri)) return;
    throw new Error('Aucune application disponible pour ouvrir le document');
  } catch {
    const opened = await openRemoteDocument(absoluteUrl);
    if (!opened) throw new Error('Impossible de télécharger ou ouvrir le document');
  }
}
