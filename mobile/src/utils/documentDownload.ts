import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_CONFIG, STORAGE_KEYS } from '../constants/config';
import i18n from '../i18n';

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

async function downloadDocumentToCache({
  url,
  filename,
  mimeType = DEFAULT_MIME_TYPE,
}: DownloadDocumentInput): Promise<{ uri: string; absoluteUrl: string; mimeType: string }> {
  const absoluteUrl = ensureAbsoluteUrl(url);
  const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const inferredFilename = appendExtensionIfMissing(
    sanitizeFilename(filename || guessFilenameFromUrl(absoluteUrl)),
    mimeType
  );
  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const localUri = `${cacheDir}${Date.now()}_${inferredFilename}`;

  const { uri } = await FileSystem.downloadAsync(absoluteUrl, localUri, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  return { uri, absoluteUrl, mimeType };
}

async function openLocalDocument(uri: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(uri);
    if (supported) {
      await Linking.openURL(uri);
      return true;
    }
  } catch {
    // Browser fallback below
  }

  try {
    await WebBrowser.openBrowserAsync(uri);
    return true;
  } catch {
    return false;
  }
}

export async function downloadAndOpenDocument({
  url,
  filename,
  mimeType = DEFAULT_MIME_TYPE,
}: DownloadDocumentInput): Promise<void> {
  try {
    const { uri, absoluteUrl } = await downloadDocumentToCache({ url, filename, mimeType });
    if (await openLocalDocument(uri)) return;
    if (await openRemoteDocument(absoluteUrl)) return;
    throw new Error(i18n.t('errors.noAppAvailable'));
  } catch {
    const opened = await openRemoteDocument(ensureAbsoluteUrl(url));
    if (!opened) throw new Error(i18n.t('errors.downloadOrOpenFailed'));
  }
}

export async function downloadAndShareDocument({
  url,
  filename,
  mimeType = DEFAULT_MIME_TYPE,
}: DownloadDocumentInput): Promise<void> {
  const { uri, absoluteUrl } = await downloadDocumentToCache({ url, filename, mimeType });
  try {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error(i18n.t('errors.shareDocument'));
    await Sharing.shareAsync(uri, {
      mimeType,
      UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
      dialogTitle: i18n.t('errors.shareDocument'),
    });
  } catch {
    const opened = await openRemoteDocument(absoluteUrl);
    if (!opened) throw new Error(i18n.t('errors.shareDocument'));
  }
}
