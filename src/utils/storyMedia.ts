import type { Story } from '../services/firebase/firestore';

const MIN_COVER_OFFSET = 20;
const MAX_COVER_OFFSET = 70;

const clampOffset = (offset?: number | null) => {
  if (typeof offset !== 'number' || Number.isNaN(offset)) return 45;
  return Math.max(MIN_COVER_OFFSET, Math.min(MAX_COVER_OFFSET, Math.round(offset)));
};

export const getStableVideoCoverOffset = (source: string) => {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) % 100000;
  }

  return MIN_COVER_OFFSET + (hash % (MAX_COVER_OFFSET - MIN_COVER_OFFSET + 1));
};

export const getCloudinaryVideoThumbnailUri = (
  videoUri?: string | null,
  offsetPercent?: number | null,
  width = 320,
  height = 520
) => {
  if (!videoUri || !videoUri.includes('cloudinary.com') || !videoUri.includes('/video/upload/')) {
    return undefined;
  }

  const [baseUrl, queryString] = videoUri.split('?');
  const frameOffset = clampOffset(offsetPercent ?? getStableVideoCoverOffset(baseUrl));
  const transformation = `so_${frameOffset}p,c_fill,w_${width},h_${height},q_auto:good,f_jpg`;
  const thumbnailUrl = baseUrl
    .replace('/video/upload/', `/video/upload/${transformation}/`)
    .replace(/\.[^/.]+$/, '.jpg');

  return queryString ? `${thumbnailUrl}?${queryString}` : thumbnailUrl;
};

export const getStoryCoverUri = (story?: Pick<Story, 'type' | 'mediaUri' | 'thumbnailUri' | 'coverOffsetPercent'> | null) => {
  if (!story?.mediaUri) return undefined;
  if (story.type === 'video') {
    return story.thumbnailUri || getCloudinaryVideoThumbnailUri(story.mediaUri, story.coverOffsetPercent);
  }
  return story.mediaUri;
};
