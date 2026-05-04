import {
  collection,
  collectionGroup,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  doc,
  documentId,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
  increment,
  Timestamp,
  Unsubscribe,
  writeBatch,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './config';
import { UserProfile } from '../../types/profile';
import { sendPushNotification } from '../pushNotifications';

// ─── User Helpers ────────────────────────────────────────────────────
export const getUserDisplayName = async (userId: string): Promise<string> => {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const data = snap.data();
      return data.displayName || data.name || 'User';
    }
    return 'User';
  } catch {
    return 'User';
  }
};

export const getUserProfileById = async (userId: string): Promise<UserProfile | null> => {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? ({ uid: userId, ...snap.data() } as UserProfile) : null;
  } catch {
    return null;
  }
};

const normalizeSearchText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const profileSearchText = (profile: Partial<UserProfile>) =>
  normalizeSearchText([
    profile.displayName,
    profile.email,
    profile.headline,
    profile.about,
    profile.bio,
    profile.location,
  ].filter(Boolean).join(' '));

export const getSearchableUserProfiles = async (
  currentUserId?: string | null,
  limitCount = 120
): Promise<UserProfile[]> => {
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(limitCount)));
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
      .filter((profile) => profile.uid !== currentUserId);
  } catch {
    return [];
  }
};

export const searchUserProfiles = async (
  queryText: string,
  currentUserId?: string | null,
  limitCount = 20
): Promise<UserProfile[]> => {
  const q = normalizeSearchText(queryText);
  if (!q) return [];

  const profiles = await getSearchableUserProfiles(currentUserId, 160);
  return profiles
    .map((profile) => {
      const name = normalizeSearchText(profile.displayName);
      const email = normalizeSearchText(profile.email);
      const combined = profileSearchText(profile);
      let score = 0;

      if (name === q) score += 80;
      if (name.startsWith(q)) score += 60;
      if (name.includes(q)) score += 40;
      if (email.includes(q)) score += 20;
      if (combined.includes(q)) score += 10;

      return { profile, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.displayName.localeCompare(b.profile.displayName))
    .slice(0, limitCount)
    .map((item) => item.profile);
};

export const subscribeToUserProfile = (
  userId: string,
  callback: (profile: UserProfile | null) => void
): Unsubscribe => {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    callback(snap.exists() ? ({ uid: userId, ...snap.data() } as UserProfile) : null);
  });
};

export const saveUserProfile = async (
  userId: string,
  profile: Partial<UserProfile>
) => {
  await setDoc(doc(db, 'users', userId), {
    ...profile,
    uid: userId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const sendUserFeedback = async (
  userId: string | null,
  email: string | null | undefined,
  message: string
) => {
  await addDoc(collection(db, 'feedback'), {
    userId: userId || null,
    email: email || null,
    message,
    status: 'new',
    createdAt: serverTimestamp(),
  });
};

type BatchUpdate = {
  ref: any;
  data: Record<string, any>;
};

const commitBatchedUpdates = async (updates: BatchUpdate[]) => {
  if (!updates.length) return;

  const commits: Promise<void>[] = [];
  let batch = writeBatch(db);
  let opCount = 0;

  for (const update of updates) {
    batch.update(update.ref, update.data);
    opCount += 1;

    if (opCount === 450) {
      commits.push(batch.commit());
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) commits.push(batch.commit());
  await Promise.all(commits);
};

export const syncUserPublicProfileReferences = async (
  userId: string,
  displayName: string,
  photoURL?: string | null
) => {
  const photo = photoURL || null;
  const updates: BatchUpdate[] = [];
  const queueUpdates = async (
    label: string,
    snapPromise: Promise<any>,
    data: Record<string, any>
  ) => {
    try {
      const snap = await snapPromise;
      snap.docs.forEach((d: any) => updates.push({ ref: d.ref, data }));
    } catch (error) {
      console.warn(`Could not sync ${label} with updated profile:`, error);
    }
  };

  await queueUpdates(
    'posts',
    getDocs(query(collection(db, 'posts'), where('authorId', '==', userId))),
    { authorName: displayName, authorPhotoURL: photo }
  );
  await queueUpdates(
    'stories',
    getDocs(query(collection(db, 'stories'), where('authorId', '==', userId))),
    { authorName: displayName, authorPhotoURL: photo }
  );
  await queueUpdates(
    'comments',
    getDocs(query(collectionGroup(db, 'comments'), where('authorId', '==', userId))),
    { authorName: displayName, authorPhotoURL: photo }
  );
  await queueUpdates(
    'chat messages',
    getDocs(query(collectionGroup(db, 'messages'), where('senderId', '==', userId))),
    { senderName: displayName, senderPhotoURL: photo }
  );

  await commitBatchedUpdates(updates);
};

// ─── Story Types ─────────────────────────────────────────────────────
export interface Story {
  id?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  type: 'text' | 'image' | 'video';
  textContent?: string;
  mediaUri?: string;
  thumbnailUri?: string | null;
  coverOffsetPercent?: number | null;
  caption?: string;
  backgroundColor?: string;
  viewedBy?: string[];
  createdAt: any;
  expiresAt: any;
}

// ─── Stories CRUD ────────────────────────────────────────────────────
export const createStory = async (story: Omit<Story, 'id' | 'createdAt' | 'expiresAt'>) => {
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000); // 24 hours
  // Strip undefined fields — Firestore rejects explicit undefined values
  const clean: Record<string, any> = { createdAt: serverTimestamp(), expiresAt };
  for (const [k, v] of Object.entries(story)) {
    if (v !== undefined) clean[k] = v;
  }
  return addDoc(collection(db, 'stories'), clean);
};

export const subscribeToStories = (
  callback: (stories: Story[]) => void
): Unsubscribe => {
  const now = Timestamp.now();
  const q = query(
    collection(db, 'stories'),
    where('expiresAt', '>', now),
    orderBy('expiresAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    const stories = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story));
    callback(stories);
  });
};

export const deleteStory = async (storyId: string) => {
  await deleteDoc(doc(db, 'stories', storyId));
};

export const deleteAllStoriesByAuthor = async (authorId: string) => {
  const q = query(collection(db, 'stories'), where('authorId', '==', authorId));
  const snap = await getDocs(q);
  const deletes = snap.docs.map(d => deleteDoc(doc(db, 'stories', d.id)));
  await Promise.all(deletes);
};

export const markStoryViewed = async (storyId: string, userId: string) => {
  const ref = doc(db, 'stories', storyId);
  await updateDoc(ref, { viewedBy: arrayUnion(userId) });
};

export const getAcceptedFriendIds = async (userId: string): Promise<string[]> => {
  const ids: string[] = [];
  // Where user is the requester
  const q1 = query(
    collection(db, 'friendships'),
    where('requesterId', '==', userId),
    where('status', '==', 'accepted')
  );
  const snap1 = await getDocs(q1);
  snap1.docs.forEach(d => ids.push(d.data().receiverId));
  // Where user is the receiver
  const q2 = query(
    collection(db, 'friendships'),
    where('receiverId', '==', userId),
    where('status', '==', 'accepted')
  );
  const snap2 = await getDocs(q2);
  snap2.docs.forEach(d => ids.push(d.data().requesterId));
  return ids;
};

// ─── Private User Reflections ───────────────────────────────────────
export interface Reflection {
  id?: string;
  userId: string;
  title: string;
  body: string;
  tags?: string;
  mood?: string | null;
  moodScore?: number | null;
  moodEmoji?: string | null;
  createdAt: any;
  updatedAt: any;
}

export const createReflection = async (
  userId: string,
  reflection: Omit<Reflection, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
) => {
  return addDoc(collection(db, 'users', userId, 'reflections'), {
    ...reflection,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateReflectionEntry = async (
  userId: string,
  reflectionId: string,
  data: Partial<Omit<Reflection, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
) => {
  await updateDoc(doc(db, 'users', userId, 'reflections', reflectionId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const deleteReflectionEntry = async (userId: string, reflectionId: string) => {
  await deleteDoc(doc(db, 'users', userId, 'reflections', reflectionId));
};

export const subscribeToUserReflections = (
  userId: string,
  callback: (reflections: Reflection[]) => void,
  limitCount = 100
): Unsubscribe => {
  const q = query(
    collection(db, 'users', userId, 'reflections'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) } as Reflection)));
  });
};

export const subscribeToUserReflection = (
  userId: string,
  reflectionId: string,
  callback: (reflection: Reflection | null) => void
): Unsubscribe => {
  return onSnapshot(doc(db, 'users', userId, 'reflections', reflectionId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Reflection) : null);
  });
};

// ─── Private User Streak ────────────────────────────────────────────
export interface UserStreak {
  streak: number;
  lastOpened: number | null;
  lostStreak: number;
  hasLostStreak: boolean;
}

const DEFAULT_STREAK: UserStreak = {
  streak: 0,
  lastOpened: null,
  lostStreak: 0,
  hasLostStreak: false,
};

export const getUserStreak = async (userId: string): Promise<UserStreak> => {
  const snap = await getDoc(doc(db, 'users', userId, 'stats', 'streak'));
  return snap.exists() ? ({ ...DEFAULT_STREAK, ...snap.data() } as UserStreak) : DEFAULT_STREAK;
};

export const saveUserStreak = async (userId: string, streak: UserStreak) => {
  await setDoc(doc(db, 'users', userId, 'stats', 'streak'), {
    ...streak,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

// Group stories by author for display
export const groupStoriesByAuthor = (stories: Story[]) => {
  const grouped: Record<string, { authorId: string; authorName: string; authorPhotoURL?: string | null; stories: Story[] }> = {};
  for (const story of stories) {
    if (!grouped[story.authorId]) {
      grouped[story.authorId] = {
        authorId: story.authorId,
        authorName: story.authorName,
        authorPhotoURL: story.authorPhotoURL || null,
        stories: [],
      };
    }
    grouped[story.authorId].authorName = story.authorName || grouped[story.authorId].authorName;
    grouped[story.authorId].authorPhotoURL = story.authorPhotoURL || grouped[story.authorId].authorPhotoURL || null;
    grouped[story.authorId].stories.push(story);
  }
  return Object.values(grouped);
};


export interface Post {
  id?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  content: string;
  likes?: string[];
  solidarity?: string[];
  likesCount?: number;
  solidarityCount?: number;
  engagementScore?: number;
  commentsCount?: number;
  comments?: number; // legacy compat
  createdAt: any;
  tags?: string[];
  // Community feed extended fields
  category?: string;
  isVentMode?: boolean;
  isVerified?: boolean;
  imageUrl?: string;
  hidden?: boolean;
  hiddenBy?: string[];
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
  text: string;
  createdAt: any;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  emoji: string;
  membersCount: number;
  members: string[];
  createdAt: any;
  category: string;
}

// ─── Default communities to initialize ───────────────────────────────
const DEFAULT_COMMUNITIES = [
  {
    id: 'anxiety-support',
    name: 'Anxiety Support',
    description: 'A safe space to share and manage anxiety together.',
    emoji: '🌬️',
    category: 'Support',
  },
  {
    id: 'sleep-better',
    name: 'Sleep Better Circle',
    description: 'Tips, routines, and support for better sleep.',
    emoji: '🌙',
    category: 'Wellness',
  },
  {
    id: 'personal-growth',
    name: 'Personal Growth',
    description: 'Celebrate wins, set goals, and grow together.',
    emoji: '🌱',
    category: 'Growth',
  },
  {
    id: 'gratitude-circle',
    name: 'Gratitude Circle',
    description: 'Daily gratitude practices and sharing.',
    emoji: '🙏',
    category: 'Mindfulness',
  },
  {
    id: 'grief-loss',
    name: 'Grief & Loss',
    description: 'Support for those navigating loss and healing.',
    emoji: '🕊️',
    category: 'Support',
  },
  {
    id: 'mindful-mornings',
    name: 'Mindful Mornings',
    description: 'Start each day with intention and calm.',
    emoji: '🌅',
    category: 'Mindfulness',
  },
];

// ─── Initialize communities if they don't exist ──────────────────────
export const initializeCommunities = async () => {
  try {
    for (const community of DEFAULT_COMMUNITIES) {
      const ref = doc(db, 'communities', community.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          name: community.name,
          description: community.description,
          emoji: community.emoji,
          category: community.category,
          membersCount: 0,
          members: [],
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (e) {
    console.warn('Failed to initialize communities:', e);
  }
};

// ─── Community subscriptions ─────────────────────────────────────────
export const subscribeToCommunities = (
  callback: (communities: Community[]) => void
): Unsubscribe => {
  const q = query(collection(db, 'communities'), orderBy('name', 'asc'));
  return onSnapshot(q, (snap) => {
    const communities = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Community[];
    callback(communities);
  });
};

export const joinCommunity = async (communityId: string, userId: string) => {
  const ref = doc(db, 'communities', communityId);
  await updateDoc(ref, {
    members: arrayUnion(userId),
    membersCount: increment(1),
  });
};

export const createCustomCommunity = async (community: Omit<Community, 'id' | 'membersCount' | 'members' | 'createdAt'>, creatorId: string) => {
  return addDoc(collection(db, 'communities'), {
    ...community,
    membersCount: 1,
    members: [creatorId],
    createdAt: serverTimestamp(),
  });
};

export const leaveCommunity = async (communityId: string, userId: string) => {
  const ref = doc(db, 'communities', communityId);
  await updateDoc(ref, {
    members: arrayRemove(userId),
    membersCount: increment(-1),
  });
};

// ─── Community Chat Messages ─────────────────────────────────────────
export const sendCommunityMessage = async (
  communityId: string,
  message: Omit<ChatMessage, 'id' | 'createdAt'>
) => {
  return addDoc(collection(db, 'communities', communityId, 'messages'), {
    ...message,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToCommunityMessages = (
  communityId: string,
  callback: (messages: ChatMessage[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'communities', communityId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
  });
};

// ─── Posts ──────────────────────────────────────────────────────
export const createPost = async (post: Omit<Post, 'id' | 'createdAt'>) => {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(post)) {
    if (value !== undefined) clean[key] = value;
  }

  return addDoc(collection(db, 'posts'), {
    ...clean,
    createdAt: serverTimestamp(),
    likes: [],
    solidarity: [],
    likesCount: 0,
    solidarityCount: 0,
    engagementScore: 0,
    commentsCount: 0,
    hiddenBy: [],
  });
};

export const getPosts = async (limitCount = 20): Promise<Post[]> => {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
};

export const getPostById = async (postId: string): Promise<Post | null> => {
  const snap = await getDoc(doc(db, 'posts', postId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
};

export const subscribeToPosts = (
  callback: (posts: Post[]) => void,
  limitCount = 30
): Unsubscribe => {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
  });
};

const POST_UPDATE_SUBSCRIPTION_CHUNK_SIZE = 10;

const chunkPostIds = (postIds: string[]) => {
  const ids = Array.from(new Set(postIds.filter(Boolean)));
  const chunks: string[][] = [];

  for (let i = 0; i < ids.length; i += POST_UPDATE_SUBSCRIPTION_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + POST_UPDATE_SUBSCRIPTION_CHUNK_SIZE));
  }

  return chunks;
};

export const subscribeToPostUpdates = (
  postIds: string[],
  callback: (updatedPosts: Post[], removedPostIds: string[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const chunks = chunkPostIds(postIds);
  if (!chunks.length) return () => {};

  const unsubscribes = chunks.map((chunk) => {
    const q = query(collection(db, 'posts'), where(documentId(), 'in', chunk));

    return onSnapshot(
      q,
      (snap) => {
        const updatedPosts: Post[] = [];
        const removedPostIds: string[] = [];

        snap.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            removedPostIds.push(change.doc.id);
            return;
          }

          updatedPosts.push({ id: change.doc.id, ...change.doc.data() } as Post);
        });

        callback(updatedPosts, removedPostIds);
      },
      onError
    );
  });

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
};

export type FeedTab = 'Trending' | 'New';

export interface FeedCursor {
  mode: FeedTab;
  category: string;
  newCursor?: QueryDocumentSnapshot<DocumentData>;
  engagementCursor?: QueryDocumentSnapshot<DocumentData>;
  recentCursor?: QueryDocumentSnapshot<DocumentData>;
  buffer: Post[];
  seenPostIds: string[];
  hasMore: boolean;
}

export interface FetchFeedPageOptions {
  mode: FeedTab;
  category?: string;
  friendIds?: string[];
  userId?: string | null;
  pageSize?: number;
  cursor?: FeedCursor | null;
}

export interface FeedPage {
  posts: Post[];
  cursor: FeedCursor;
}

const DEFAULT_FEED_PAGE_SIZE = 20;
const TRENDING_CANDIDATE_MULTIPLIER = 3;
const FRIEND_SCORE_BOOST = 2;
const MAX_RECENCY_BOOST = 2;
const RECENCY_DECAY_HOURS = 24;

const normalizeFeedCategory = (category?: string) =>
  !category || category === 'All' ? 'All' : category;

const getPostCreatedAtMillis = (post: Post) => {
  if (post.createdAt?.toMillis) return post.createdAt.toMillis();
  if (post.createdAt?.toDate) return post.createdAt.toDate().getTime();
  if (typeof post.createdAt === 'number') return post.createdAt;
  return 0;
};

export const getPostEngagementCount = (post: Post) => {
  const likesCount = Array.isArray(post.likes)
    ? post.likes.length
    : typeof post.likesCount === 'number' ? post.likesCount : 0;
  const solidarityCount = Array.isArray(post.solidarity)
    ? post.solidarity.length
    : typeof post.solidarityCount === 'number' ? post.solidarityCount : 0;

  return likesCount + solidarityCount;
};

const getRecencyBoost = (post: Post) => {
  const createdAt = getPostCreatedAtMillis(post);
  if (!createdAt) return 0;

  const ageHours = Math.max(0, (Date.now() - createdAt) / (60 * 60 * 1000));
  return MAX_RECENCY_BOOST * Math.exp(-ageHours / RECENCY_DECAY_HOURS);
};

export const getTrendingScore = (post: Post, friendIds: string[] = []) => {
  const engagement = typeof post.engagementScore === 'number'
    ? post.engagementScore
    : getPostEngagementCount(post);
  const friendBoost = friendIds.includes(post.authorId) ? FRIEND_SCORE_BOOST : 0;

  return engagement + getRecencyBoost(post) + friendBoost;
};

export const sortFeedPosts = (
  posts: Post[],
  mode: FeedTab,
  friendIds: string[] = []
) => {
  const sorted = [...posts];
  if (mode === 'New') {
    return sorted.sort((a, b) => getPostCreatedAtMillis(b) - getPostCreatedAtMillis(a));
  }

  return sorted.sort((a, b) => {
    const scoreDiff = getTrendingScore(b, friendIds) - getTrendingScore(a, friendIds);
    if (scoreDiff !== 0) return scoreDiff;
    return getPostCreatedAtMillis(b) - getPostCreatedAtMillis(a);
  });
};

const shouldShowPostInFeed = (
  post: Post,
  category: string,
  userId?: string | null,
  seenPostIds: Set<string> = new Set()
) => {
  if (!post.id || seenPostIds.has(post.id)) return false;
  if (post.hidden) return false;
  if (userId && Array.isArray(post.hiddenBy) && post.hiddenBy.includes(userId)) return false;
  if (category !== 'All' && (post.category || 'General').toLowerCase() !== category.toLowerCase()) {
    return false;
  }
  return true;
};

const buildPostQuery = (
  mode: 'new' | 'engagement' | 'recent',
  category: string,
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>
) => {
  const constraints: any[] = [];
  if (category !== 'All') constraints.push(where('category', '==', category));

  if (mode === 'engagement') {
    constraints.push(orderBy('engagementScore', 'desc'), orderBy('createdAt', 'desc'));
  } else {
    constraints.push(orderBy('createdAt', 'desc'));
  }

  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));

  return query(collection(db, 'posts'), ...constraints);
};

const buildRecentOnlyPostQuery = (
  pageSize: number,
  cursor?: QueryDocumentSnapshot<DocumentData>
) => {
  const constraints: any[] = [orderBy('createdAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  return query(collection(db, 'posts'), ...constraints);
};

const docsToPosts = (docs: QueryDocumentSnapshot<DocumentData>[]) =>
  docs.map((d) => ({ id: d.id, ...d.data() } as Post));

const uniquePosts = (posts: Post[]) => {
  const map = new Map<string, Post>();
  posts.forEach((post) => {
    if (post.id && !map.has(post.id)) map.set(post.id, post);
  });
  return Array.from(map.values());
};

const isMissingFirestoreIndexError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  const message = error instanceof Error ? error.message : String(error);

  return code === 'failed-precondition' && message.includes('requires an index');
};

const fetchFeedPageFromRecentIndex = async ({
  mode,
  category: rawCategory = 'All',
  friendIds = [],
  userId,
  pageSize = DEFAULT_FEED_PAGE_SIZE,
  cursor,
}: FetchFeedPageOptions): Promise<FeedPage> => {
  const category = normalizeFeedCategory(rawCategory);
  const sameCursor =
    cursor && cursor.mode === mode && cursor.category === category ? cursor : null;
  const seenPostIds = new Set(sameCursor?.seenPostIds || []);
  const queryLimit = Math.max(pageSize * TRENDING_CANDIDATE_MULTIPLIER, pageSize);
  const maxAttempts = category === 'All' ? 3 : 5;

  let recentCursor = mode === 'New' ? sameCursor?.newCursor : sameCursor?.recentCursor;
  let candidates = uniquePosts(sameCursor?.buffer || []).filter((post) =>
    shouldShowPostInFeed(post, category, userId, seenPostIds)
  );
  let hasMore = true;
  let attempts = 0;

  while (candidates.length < pageSize && hasMore && attempts < maxAttempts) {
    attempts += 1;
    const snap = await getDocs(buildRecentOnlyPostQuery(queryLimit, recentCursor));
    hasMore = snap.docs.length > 0;
    recentCursor = snap.docs[snap.docs.length - 1] || recentCursor;

    const nextPosts = docsToPosts(snap.docs).filter((post) =>
      shouldShowPostInFeed(post, category, userId, seenPostIds)
    );

    candidates = sortFeedPosts(uniquePosts([...candidates, ...nextPosts]), mode, friendIds);
  }

  const pagePosts = candidates.slice(0, pageSize);
  pagePosts.forEach((post) => {
    if (post.id) seenPostIds.add(post.id);
  });

  return {
    posts: pagePosts,
    cursor: {
      mode,
      category,
      newCursor: mode === 'New' ? recentCursor : sameCursor?.newCursor,
      engagementCursor: undefined,
      recentCursor: mode === 'Trending' ? recentCursor : sameCursor?.recentCursor,
      buffer: candidates.slice(pageSize),
      seenPostIds: Array.from(seenPostIds),
      hasMore: hasMore || candidates.length > pageSize,
    },
  };
};

const fetchFeedPageWithCompositeIndexes = async ({
  mode,
  category: rawCategory = 'All',
  friendIds = [],
  userId,
  pageSize = DEFAULT_FEED_PAGE_SIZE,
  cursor,
}: FetchFeedPageOptions): Promise<FeedPage> => {
  const category = normalizeFeedCategory(rawCategory);
  const sameCursor =
    cursor && cursor.mode === mode && cursor.category === category ? cursor : null;
  const seenPostIds = new Set(sameCursor?.seenPostIds || []);
  const candidateLimit = Math.max(pageSize * TRENDING_CANDIDATE_MULTIPLIER, pageSize);

  if (mode === 'New') {
    const collected: Post[] = [];
    let newCursor = sameCursor?.newCursor;
    let hasMore = true;
    let attempts = 0;

    while (collected.length < pageSize && hasMore && attempts < 3) {
      attempts += 1;
      const snap = await getDocs(buildPostQuery('new', category, pageSize * 2, newCursor));
      hasMore = snap.docs.length > 0;
      newCursor = snap.docs[snap.docs.length - 1] || newCursor;

      const nextPosts = docsToPosts(snap.docs).filter((post) =>
        shouldShowPostInFeed(post, category, userId, seenPostIds)
      );

      nextPosts.forEach((post) => {
        if (post.id) seenPostIds.add(post.id);
      });
      collected.push(...nextPosts);
    }

    const pagePosts = sortFeedPosts(collected, 'New').slice(0, pageSize);
    return {
      posts: pagePosts,
      cursor: {
        mode,
        category,
        newCursor,
        buffer: [],
        seenPostIds: Array.from(seenPostIds),
        hasMore,
      },
    };
  }

  let engagementCursor = sameCursor?.engagementCursor;
  let recentCursor = sameCursor?.recentCursor;
  let candidates = sameCursor?.buffer || [];
  let hasMore = true;
  let attempts = 0;

  while (candidates.length < pageSize && hasMore && attempts < 3) {
    attempts += 1;
    const [engagementSnap, recentSnap] = await Promise.all([
      getDocs(buildPostQuery('engagement', category, candidateLimit, engagementCursor)),
      getDocs(buildPostQuery('recent', category, candidateLimit, recentCursor)),
    ]);

    engagementCursor = engagementSnap.docs[engagementSnap.docs.length - 1] || engagementCursor;
    recentCursor = recentSnap.docs[recentSnap.docs.length - 1] || recentCursor;
    hasMore = engagementSnap.docs.length > 0 || recentSnap.docs.length > 0;

    const nextCandidates = uniquePosts([
      ...candidates,
      ...docsToPosts(engagementSnap.docs),
      ...docsToPosts(recentSnap.docs),
    ]).filter((post) => shouldShowPostInFeed(post, category, userId, seenPostIds));

    candidates = sortFeedPosts(nextCandidates, 'Trending', friendIds);
  }

  const pagePosts = candidates.slice(0, pageSize);
  pagePosts.forEach((post) => {
    if (post.id) seenPostIds.add(post.id);
  });

  return {
    posts: pagePosts,
    cursor: {
      mode,
      category,
      engagementCursor,
      recentCursor,
      buffer: candidates.slice(pageSize),
      seenPostIds: Array.from(seenPostIds),
      hasMore: hasMore || candidates.length > pageSize,
    },
  };
};

export const fetchFeedPage = async (options: FetchFeedPageOptions): Promise<FeedPage> => {
  try {
    return await fetchFeedPageWithCompositeIndexes(options);
  } catch (error) {
    if (!isMissingFirestoreIndexError(error)) throw error;

    console.log('Using recent-post feed fallback until the Firestore feed index is available.');
    return fetchFeedPageFromRecentIndex(options);
  }
};

export const toggleLike = async (postId: string, userId: string, liked: boolean) => {
  const ref = doc(db, 'posts', postId);
  const delta = liked ? -1 : 1;

  await updateDoc(ref, {
    likes: liked ? arrayRemove(userId) : arrayUnion(userId),
    likesCount: increment(delta),
    engagementScore: increment(delta),
  });
};

export const toggleSolidarity = async (postId: string, userId: string, active: boolean) => {
  const ref = doc(db, 'posts', postId);
  const delta = active ? -1 : 1;

  await updateDoc(ref, {
    solidarity: active ? arrayRemove(userId) : arrayUnion(userId),
    solidarityCount: increment(delta),
    engagementScore: increment(delta),
  });
};

// ─── Post Comments (sub-collection) ──────────────────────────────
export interface PostComment {
  id?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  text: string;
  createdAt: any;
}

export const addPostComment = async (
  postId: string,
  comment: Omit<PostComment, 'id' | 'createdAt'>
) => {
  const commentRef = await addDoc(collection(db, 'posts', postId, 'comments'), {
    ...comment,
    createdAt: serverTimestamp(),
  });
  // increment the denormalized count
  const ref = doc(db, 'posts', postId);
  await updateDoc(ref, { commentsCount: increment(1) });
  return commentRef.id;
};

export const subscribeToPostComments = (
  postId: string,
  callback: (comments: PostComment[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(200)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as PostComment)));
  });
};

// ─── Post management (edit / delete / hide) ──────────────────────
export const deletePostComment = async (postId: string, commentId: string) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'posts', postId, 'comments', commentId));
  batch.update(doc(db, 'posts', postId), { commentsCount: increment(-1) });
  await batch.commit();
};

export const updatePost = async (postId: string, data: Partial<Post>) => {
  const ref = doc(db, 'posts', postId);
  await updateDoc(ref, data as any);
};

export const deletePost = async (postId: string) => {
  await deleteDoc(doc(db, 'posts', postId));
};

export const hidePostForUser = async (postId: string, userId: string) => {
  const ref = doc(db, 'posts', postId);
  await updateDoc(ref, { hiddenBy: arrayUnion(userId) });
};

export const unhidePostForUser = async (postId: string, userId: string) => {
  const ref = doc(db, 'posts', postId);
  await updateDoc(ref, { hiddenBy: arrayRemove(userId) });
};

export const subscribeToUserPosts = (
  userId: string,
  callback: (posts: Post[]) => void,
  limitCount = 20
): Unsubscribe => {
  // NOTE: orderBy removed to fix the missing composite index error.
  const q = query(
    collection(db, 'posts'),
    where('authorId', '==', userId),
    limit(limitCount)
  );
  return onSnapshot(q, snap => {
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
    posts.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    callback(posts);
  });
};

export const getPostsByIds = async (postIds: string[]): Promise<Post[]> => {
  if (postIds.length === 0) return [];
  const posts: Post[] = [];
  // Firestore 'in' supports max 30 items
  for (let i = 0; i < postIds.length; i += 30) {
    const chunk = postIds.slice(i, i + 30);
    const q = query(collection(db, 'posts'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    posts.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
  }
  return posts;
};

export const getHiddenPostsForUser = async (userId: string): Promise<Post[]> => {
  // NOTE: Removed orderBy to avoid requiring a composite Firestore index.
  // Posts are sorted client-side instead.
  const q = query(
    collection(db, 'posts'),
    where('hiddenBy', 'array-contains', userId),
    limit(50)
  );
  const snap = await getDocs(q);
  const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  // Sort by createdAt descending locally
  posts.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });
  return posts;
};

// Chat Messages (legacy community room)
export const sendMessage = async (roomId: string, message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
  return addDoc(collection(db, 'chats', roomId, 'messages'), {
    ...message,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToMessages = (
  roomId: string,
  callback: (messages: ChatMessage[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'chats', roomId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
  });
};

// ─── Notifications ─────────────────────────────────────────────────
export interface AppNotification {
  id?: string;
  type: 'like' | 'solidarity' | 'comment' | 'message' | 'friend_request' | 'friend_accepted' | 'streak' | 'reminder' | 'community';
  text: string;
  fromUserId?: string;
  fromUserName?: string;
  postId?: string;
  commentId?: string;
  chatId?: string;
  friendshipId?: string;
  read: boolean;
  seenInBell?: boolean;
  createdAt: any;
}

interface NotificationPreferences {
  notificationsEnabled: boolean;
  dailyReminder: boolean;
  emailNotifications: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notificationsEnabled: true,
  dailyReminder: true,
  emailNotifications: true,
};

const getNotificationPreferences = async (userId: string): Promise<NotificationPreferences> => {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'settings', 'preferences'));
    let data = snap.exists() ? snap.data() : {};
    if (!snap.exists()) {
      const userSnap = await getDoc(doc(db, 'users', userId));
      const userData = userSnap.exists() ? userSnap.data() : {};
      data = userData.notificationSettings || userData.appSettings || {};
    }
    return {
      notificationsEnabled: data.notificationsEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.notificationsEnabled,
      dailyReminder: data.dailyReminder ?? DEFAULT_NOTIFICATION_PREFERENCES.dailyReminder,
      emailNotifications: data.emailNotifications ?? DEFAULT_NOTIFICATION_PREFERENCES.emailNotifications,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

export const getNotifications = async (userId: string) => {
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifications: AppNotification[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
  });
};

export const subscribeToUnreadNotificationsCount = (
  userId: string,
  callback: (count: number) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    where('read', '==', false)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.filter((item) => item.data().seenInBell !== true).length);
  });
};

export const createNotification = async (
  targetUserId: string,
  notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
) => {
  const preferences = await getNotificationPreferences(targetUserId);
  if (!preferences.notificationsEnabled) return;
  if ((notification.type === 'reminder' || notification.type === 'streak') && !preferences.dailyReminder) return;

  await addDoc(collection(db, 'notifications', targetUserId, 'items'), {
    ...notification,
    read: false,
    seenInBell: false,
    createdAt: serverTimestamp(),
  });

  try {
    const userSnap = await getDoc(doc(db, 'users', targetUserId));
    if (userSnap.exists()) {
      const userData = userSnap.data();
      if (userData.pushToken) {
        let title = 'Mindspace';
        if (notification.type === 'message') title = 'New Message';
        else if (notification.type === 'comment') title = 'New Comment';
        else if (notification.type === 'friend_request') title = 'Friend Request';
        
        await sendPushNotification(userData.pushToken, title, notification.text, { type: notification.type });
      }
    }
  } catch (e) {
    console.warn('Failed to send push notification', e);
  }
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  const ref = doc(db, 'notifications', userId, 'items', notificationId);
  await updateDoc(ref, { read: true, seenInBell: true });
};

export const markAllNotificationsRead = async (userId: string) => {
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  const updates = snap.docs.map(d =>
    updateDoc(doc(db, 'notifications', userId, 'items', d.id), { read: true, seenInBell: true })
  );
  await Promise.all(updates);
};

export const markAllNotificationsSeenInBell = async (userId: string) => {
  const q = query(
    collection(db, 'notifications', userId, 'items'),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  const updates = snap.docs
    .filter((item) => item.data().seenInBell !== true)
    .map((item) => updateDoc(item.ref, { seenInBell: true }));
  await Promise.all(updates);
};

export const deleteNotification = async (userId: string, notificationId: string) => {
  await deleteDoc(doc(db, 'notifications', userId, 'items', notificationId));
};

export const deleteAllNotifications = async (userId: string) => {
  const snap = await getDocs(collection(db, 'notifications', userId, 'items'));
  const commits: Promise<void>[] = [];
  let batch = writeBatch(db);
  let opCount = 0;

  for (const item of snap.docs) {
    batch.delete(item.ref);
    opCount += 1;

    if (opCount === 450) {
      commits.push(batch.commit());
      batch = writeBatch(db);
      opCount = 0;
    }
  }

  if (opCount > 0) commits.push(batch.commit());
  await Promise.all(commits);
};

// ─── Friendships ───────────────────────────────────────────────────
export interface Friendship {
  id?: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
  createdAt: any;
}

export const sendFriendRequest = async (requesterId: string, receiverId: string) => {
  const docRef = await addDoc(collection(db, 'friendships'), {
    requesterId,
    receiverId,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const acceptFriendRequest = async (friendshipId: string) => {
  const ref = doc(db, 'friendships', friendshipId);
  await updateDoc(ref, { status: 'accepted' });
};

export const subscribeToFriendshipStatus = (
  userId1: string,
  userId2: string,
  callback: (friendship: Friendship | null) => void
): Unsubscribe => {
  const q1 = query(collection(db, 'friendships'), where('requesterId', '==', userId1), where('receiverId', '==', userId2));
  const q2 = query(collection(db, 'friendships'), where('requesterId', '==', userId2), where('receiverId', '==', userId1));
  
  let latest: Friendship | null = null;
  const unsub1 = onSnapshot(q1, snap => {
    if (!snap.empty) {
      latest = { id: snap.docs[0].id, ...snap.docs[0].data() } as Friendship;
      callback(latest);
    } else if (!latest) callback(null);
  });
  
  const unsub2 = onSnapshot(q2, snap => {
    if (!snap.empty) {
      latest = { id: snap.docs[0].id, ...snap.docs[0].data() } as Friendship;
      callback(latest);
    } else if (!latest) callback(null);
  });
  
  return () => { unsub1(); unsub2(); };
};

// ─── Direct Messages ───────────────────────────────────────────────
export type DMType = 'text' | 'image' | 'video' | 'audio' | 'document';

export interface DirectMessage {
  id?: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  type?: DMType;
  mediaUrl?: string;
  fileName?: string;
  deletedFor?: string[];
  createdAt: any;
}

export interface DirectMessageSearchResult {
  chatId: string;
  friendId: string;
  matchedCount: number;
  snippet: string;
  lastMessageTime: any;
}

export const getChatId = (uid1: string, uid2: string) => 
  [uid1, uid2].sort().join('_');

export const sendDirectMessage = async (
  senderId: string,
  receiverId: string,
  text: string,
  type: DMType = 'text',
  mediaUrl?: string,
  fileName?: string,
) => {
  const chatId = getChatId(senderId, receiverId);
  await addDoc(collection(db, 'direct_messages'), {
    chatId,
    senderId,
    receiverId,
    text,
    type,
    ...(mediaUrl ? { mediaUrl } : {}),
    ...(fileName ? { fileName } : {}),
    createdAt: serverTimestamp(),
  });
};

export const deleteDirectMessage = async (messageId: string) => {
  await deleteDoc(doc(db, 'direct_messages', messageId));
};

export const deleteAllDirectMessages = async (chatId: string) => {
  const q = query(collection(db, 'direct_messages'), where('chatId', '==', chatId));
  const snap = await getDocs(q);
  const deletePromises = snap.docs.map(d => deleteDoc(doc(db, 'direct_messages', d.id)));
  await Promise.all(deletePromises);
};

export const deleteDirectMessageForUser = async (messageId: string, userId: string) => {
  await updateDoc(doc(db, 'direct_messages', messageId), {
    deletedFor: arrayUnion(userId),
  });
};

export const deleteAllDirectMessagesForUser = async (chatId: string, userId: string) => {
  const q = query(collection(db, 'direct_messages'), where('chatId', '==', chatId));
  const snap = await getDocs(q);
  await commitBatchedUpdates(
    snap.docs.map((d) => ({
      ref: d.ref,
      data: { deletedFor: arrayUnion(userId) },
    }))
  );
};

export const subscribeToDirectMessages = (
  chatId: string,
  userId: string,
  callback: (messages: DirectMessage[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'direct_messages'),
    where('chatId', '==', chatId)
  );
  return onSnapshot(q, snap => {
    const messages = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as DirectMessage))
      .filter(message => !Array.isArray(message.deletedFor) || !message.deletedFor.includes(userId));
    messages.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    callback(messages);
  });
};

// ─── DM Conversations List ─────────────────────────────────────────
const getTimestampMillis = (value: any) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === 'number') return value;
  return 0;
};

const getMessageFriendId = (message: DirectMessage, userId: string) =>
  message.senderId === userId ? message.receiverId : message.senderId;

export const searchUserDirectMessages = async (
  userId: string,
  queryText: string,
  limitCount = 20
): Promise<DirectMessageSearchResult[]> => {
  const q = normalizeSearchText(queryText);
  if (!q) return [];

  try {
    const [sentSnap, receivedSnap] = await Promise.all([
      getDocs(query(collection(db, 'direct_messages'), where('senderId', '==', userId))),
      getDocs(query(collection(db, 'direct_messages'), where('receiverId', '==', userId))),
    ]);

    const matches = [...sentSnap.docs, ...receivedSnap.docs]
      .map((d) => ({ id: d.id, ...d.data() } as DirectMessage))
      .filter((message) => !Array.isArray(message.deletedFor) || !message.deletedFor.includes(userId))
      .filter((message) => normalizeSearchText(message.text).includes(q))
      .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));

    const grouped = new Map<string, DirectMessageSearchResult>();
    matches.forEach((message) => {
      const friendId = getMessageFriendId(message, userId);
      const existing = grouped.get(message.chatId);
      if (existing) {
        existing.matchedCount += 1;
        if (getTimestampMillis(message.createdAt) > getTimestampMillis(existing.lastMessageTime)) {
          existing.snippet = message.text;
          existing.lastMessageTime = message.createdAt;
        }
        return;
      }

      grouped.set(message.chatId, {
        chatId: message.chatId,
        friendId,
        matchedCount: 1,
        snippet: message.text,
        lastMessageTime: message.createdAt,
      });
    });

    return Array.from(grouped.values())
      .sort((a, b) => getTimestampMillis(b.lastMessageTime) - getTimestampMillis(a.lastMessageTime))
      .slice(0, limitCount);
  } catch {
    return [];
  }
};

export interface DMConversation {
  chatId: string;
  friendId: string;
  friendName: string;
  lastMessage: string;
  lastMessageTime: any;
}

export const subscribeToUserDMConversations = (
  userId: string,
  callback: (convos: DMConversation[]) => void
): Unsubscribe => {
  // Listen to all DMs where user is sender
  const q1 = query(collection(db, 'direct_messages'), where('senderId', '==', userId));
  // Listen to all DMs where user is receiver
  const q2 = query(collection(db, 'direct_messages'), where('receiverId', '==', userId));

  let sentMsgs: DirectMessage[] = [];
  let recvMsgs: DirectMessage[] = [];

  const buildConvos = () => {
    const allMsgs = [...sentMsgs, ...recvMsgs]
      .filter(message => !Array.isArray(message.deletedFor) || !message.deletedFor.includes(userId));
    // Group by chatId
    const map = new Map<string, DirectMessage[]>();
    allMsgs.forEach(m => {
      const list = map.get(m.chatId) || [];
      list.push(m);
      map.set(m.chatId, list);
    });

    const convos: DMConversation[] = [];
    map.forEach((msgs, chatId) => {
      // Sort by time desc to get latest
      msgs.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tb - ta;
      });
      const latest = msgs[0];
      const friendId = latest.senderId === userId ? latest.receiverId : latest.senderId;
      convos.push({
        chatId,
        friendId,
        friendName: '', // Will be resolved on the client side
        lastMessage: latest.text,
        lastMessageTime: latest.createdAt,
      });
    });

    // Sort conversations by latest message time
    convos.sort((a, b) => {
      const ta = a.lastMessageTime?.toMillis ? a.lastMessageTime.toMillis() : 0;
      const tb = b.lastMessageTime?.toMillis ? b.lastMessageTime.toMillis() : 0;
      return tb - ta;
    });

    callback(convos);
  };

  const unsub1 = onSnapshot(q1, snap => {
    sentMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage));
    buildConvos();
  });

  const unsub2 = onSnapshot(q2, snap => {
    recvMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage));
    buildConvos();
  });

  return () => { unsub1(); unsub2(); };
};
