import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Linking, Platform } from 'react-native';

import * as IntentLauncher from 'expo-intent-launcher';

let isOpeningDocument = false;

// Simple hash function for URLs
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

/**
 * Opens a remote document by downloading it to cache and passing a real file URI
 * to the native chooser. Data URIs are rejected by many PDF/DOC viewers.
 */
export const openDocument = async (url: string, fileName?: string) => {
  if (isOpeningDocument) return;
  isOpeningDocument = true;

  try {
    const isSharingAvailable = await Sharing.isAvailableAsync();
    if (!isSharingAvailable) {
      await Linking.openURL(getDownloadUrl(url));
      return;
    }

    const safeName = sanitizeFileName(fileName || getFileNameFromUrl(url) || 'Document');
    const urlHash = hashString(url);
    const localUri = `${FileSystem.cacheDirectory || ''}${urlHash}-${safeName}`;
    
    // Check if we already downloaded this exact file
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    let finalUri = localUri;
    
    if (!fileInfo.exists) {
      const result = await FileSystem.downloadAsync(getDownloadUrl(url), localUri);
      if (result.status && result.status >= 400) {
        throw new Error(`HTTP ${result.status}`);
      }
      finalUri = result.uri;
    }

    const mimeType = guessMimeType(safeName);

    if (Platform.OS === 'android') {
      try {
        const contentUri = await FileSystem.getContentUriAsync(finalUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
      } catch (e) {
        console.log('IntentLauncher failed, falling back to Sharing:', e);
        await Sharing.shareAsync(finalUri, {
          mimeType,
          dialogTitle: `Open ${fileName || 'Document'}`,
        });
      }
    } else {
      // On iOS, Sharing.shareAsync natively presents the 'Open with...' UI
      await Sharing.shareAsync(finalUri, {
        mimeType,
        dialogTitle: `Open ${fileName || 'Document'}`,
      });
    }
  } catch (fileError) {
    console.log('Document open failed, falling back to Linking:', fileError);
    try {
      await Linking.openURL(getDownloadUrl(url));
    } catch (linkError: any) {
      console.error('openDocument error:', linkError);
      Alert.alert('Error', 'Could not open the file.');
    }
  } finally {
    // Release the lock after a short delay so the native UI has time to appear
    setTimeout(() => {
      isOpeningDocument = false;
    }, 1000);
  }
};

const getDownloadUrl = (url: string): string => {
  // Cloudinary unsigned uploads (especially raw files) reject transformations like fl_attachment with a 401 error.
  // We must use the exact original URL.
  return url;
};

const getFileNameFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.split('/').filter(Boolean).pop();
    return pathname ? decodeURIComponent(pathname) : '';
  } catch {
    const clean = url.split('?')[0];
    return decodeURIComponent(clean.split('/').pop() || '');
  }
};

const sanitizeFileName = (name: string): string => {
  const trimmed = name.trim() || 'Document';
  const withoutUnsafeChars = trimmed.replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '_');
  return withoutUnsafeChars.includes('.') ? withoutUnsafeChars : `${withoutUnsafeChars}.pdf`;
};

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    zip: 'application/zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
  };
  return map[ext] || 'application/octet-stream';
}
