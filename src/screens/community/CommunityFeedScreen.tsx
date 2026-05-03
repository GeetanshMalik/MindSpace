import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, ScrollView, TouchableOpacity, TextInput, Image, Alert, Modal, KeyboardAvoidingView, Platform, Animated, Share as RNShare, ActivityIndicator } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { Avatar } from '../../components/Avatar';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { useAuthStore } from '../../store/authStore';
import { getFeedCacheKey, usePostStore } from '../../store/postStore';
import {
  createPost, Post,
  createStory, subscribeToStories, Story, groupStoriesByAuthor,
  toggleLike, toggleSolidarity,
  addPostComment, subscribeToPostComments, PostComment,
  updatePost, deletePost, deletePostComment, hidePostForUser,
  deleteAllStoriesByAuthor, getAcceptedFriendIds,
  createNotification,
  fetchFeedPage, subscribeToPostUpdates, FeedCursor, FeedTab,
} from '../../services/firebase/firestore';
import { uploadMedia, getMediaPath, getExtensionFromUri } from '../../services/firebase/storage';
import { useTranslation } from '../../i18n/useTranslation';
import { StoryViewer, PreviewVideo, STORY_BG_COLORS } from '../../components/StoryViewer';
import { getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';
import { getCloudinaryVideoThumbnailUri, getStableVideoCoverOffset, getStoryCoverUri } from '../../utils/storyMedia';
import { applyPostReaction, getReactionCount, hasUserReaction, ReactionField } from '../../utils/postReactions';
import { getPostShareUrl } from '../../utils/shareLinks';

const APP_LOGO = require('../../../assets/logo.png');

const TABS: Array<FeedTab | 'Categories'> = ['Trending', 'New', 'Categories'];
const CATEGORIES = ['All', 'General', 'Depression', 'Break-up', 'Workload', 'Anxiety', 'Grief', 'Loneliness', 'Self-care', 'Stress', 'Relationships', 'Family', 'Career', 'Health', 'Others'];

const TAB_ICONS: Record<string, string> = {
  Trending: 'trending-up',
  New: 'sparkles',
  Categories: 'grid',
};

const FEED_PAGE_SIZE = 20;
const VIDEO_COVER_FALLBACK_OFFSETS = [45, 60, 30, 70, 20];


const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const StoryCover: React.FC<{ story?: Story | null }> = ({ story }) => {
  const [coverAttempt, setCoverAttempt] = useState(0);

  const coverCandidates = useMemo(() => {
    if (!story?.mediaUri) return [];
    if (story.type !== 'video') return [story.mediaUri];

    const candidates = [
      getStoryCoverUri(story),
      ...VIDEO_COVER_FALLBACK_OFFSETS.map((offset) =>
        getCloudinaryVideoThumbnailUri(story.mediaUri, offset)
      ),
    ].filter(Boolean) as string[];

    return Array.from(new Set(candidates));
  }, [story?.id, story?.mediaUri, story?.thumbnailUri, story?.coverOffsetPercent, story?.type]);

  useEffect(() => {
    setCoverAttempt(0);
  }, [story?.id, story?.mediaUri]);

  if (!story) return null;

  const coverUri = coverCandidates[coverAttempt];
  if (coverUri) {
    return (
      <>
        <Image
          source={{ uri: coverUri }}
          style={styles.storyBubbleImage}
          resizeMode="cover"
          onError={() => setCoverAttempt((attempt) => Math.min(attempt + 1, coverCandidates.length))}
        />
        {story.type === 'video' && (
          <View style={styles.storyVideoBadge}>
            <Ionicons name="play" size={12} color="#fff" />
          </View>
        )}
      </>
    );
  }

  if (story.type === 'video') {
    return (
      <View style={styles.storyVideoFallback}>
        <Ionicons name="videocam" size={22} color="rgba(255,255,255,0.85)" />
      </View>
    );
  }

  return (
    <Text translate={false} style={styles.storyBubbleText} numberOfLines={3}>
      {story.textContent?.substring(0, 40) || ''}
    </Text>
  );
};

// ─── Create Story Modal ──────────────────────────────────────────────
interface CreateStoryModalProps {
  visible: boolean;
  onClose: () => void;
  onPostInBackground: (task: () => Promise<void>) => void;
  user: any;
  authorName: string;
  authorPhotoURL?: string;
}

const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ visible, onClose, onPostInBackground, user, authorName, authorPhotoURL }) => {
  const C = useColors();
  const [storyType, setStoryType] = useState<'text' | 'image' | 'video'>('text');
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedBg, setSelectedBg] = useState(STORY_BG_COLORS[0]);
  const [posting, setPosting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setMediaUri(result.assets[0].uri);
      setStoryType('image');
    }
  };

  const pickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      // Check duration — if > 30s, warn user
      if (asset.duration && asset.duration > 30000) {
        Alert.alert(
          'Video Too Long',
          'Videos can only be shared up to 30 seconds. Your video will be trimmed to 30 seconds.',
          [{ text: 'OK' }]
        );
      }
      setMediaUri(asset.uri);
      setStoryType('video');
    }
  };

  const handlePost = () => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (storyType === 'text' && !textContent.trim()) { Alert.alert('Write something!'); return; }
    if ((storyType === 'image' || storyType === 'video') && !mediaUri) { Alert.alert('Select media!'); return; }

    // Capture values before resetting state
    const _type = storyType;
    const _text = textContent.trim();
    const _media = mediaUri;
    const _caption = caption.trim();
    const _bg = selectedBg;

    // Reset form & close modal INSTANTLY
    setTextContent(''); setMediaUri(null); setCaption('');
    setStoryType('text'); setSelectedBg(STORY_BG_COLORS[0]);
    setPosting(false);
    onClose();

    // Fire the upload in the background via parent callback
    onPostInBackground(async () => {
      let uploadedMediaUri = _media;
      let thumbnailUri: string | undefined;
      let coverOffsetPercent: number | undefined;
      if (_media && (_type === 'image' || _type === 'video')) {
        const ext = getExtensionFromUri(_media);
        const path = getMediaPath('stories', user.uid, ext);
        uploadedMediaUri = await uploadMedia(_media, path, _type === 'video' ? 'video' : 'image');
        if (_type === 'video' && uploadedMediaUri) {
          coverOffsetPercent = getStableVideoCoverOffset(uploadedMediaUri);
          thumbnailUri = getCloudinaryVideoThumbnailUri(uploadedMediaUri, coverOffsetPercent);
        }
      }
      await createStory({
        authorId: user.uid,
        authorName,
        authorPhotoURL: authorPhotoURL || null,
        type: _type,
        ...(_type === 'text' ? { textContent: _text } : {}),
        ...(uploadedMediaUri ? { mediaUri: uploadedMediaUri } : {}),
        ...(thumbnailUri ? { thumbnailUri } : {}),
        ...(coverOffsetPercent ? { coverOffsetPercent } : {}),
        ...(_caption ? { caption: _caption } : {}),
        backgroundColor: _type === 'text' ? _bg : '#000',
      });
    });
  };

  const reset = () => {
    setTextContent(''); setMediaUri(null); setCaption('');
    setStoryType('text'); setSelectedBg(STORY_BG_COLORS[0]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={reset}>
      <KeyboardAvoidingView style={[csStyles.modal, { backgroundColor: C.surface }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[csStyles.header, { borderBottomColor: C.outlineVariant + '44' }]}>
          <TouchableOpacity onPress={reset}>
            <Text style={[csStyles.cancelText, { color: C.onSurfaceVariant }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[csStyles.title, { color: C.onSurface }]}>Create Story</Text>
          <TouchableOpacity
            style={[csStyles.postBtn, { backgroundColor: C.primary }, posting && { opacity: 0.6 }]}
            onPress={handlePost}
            disabled={posting}
          >
            <Text style={[csStyles.postBtnText, { color: C.onPrimary }]}>{posting ? 'Posting...' : 'Share'}</Text>
          </TouchableOpacity>
        </View>

        <View style={csStyles.typeRow}>
          {(['text', 'image', 'video'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[csStyles.typeBtn, { backgroundColor: storyType === t ? C.primary : C.surfaceContainerHighest }]}
              onPress={() => { setStoryType(t); if (t === 'text') setMediaUri(null); }}
            >
              <Ionicons
                name={t === 'text' ? 'text' : t === 'image' ? 'image' : 'videocam'}
                size={16}
                color={storyType === t ? C.onPrimary : C.onSurfaceVariant}
              />
              <Text style={[csStyles.typeText, { color: storyType === t ? C.onPrimary : C.onSurfaceVariant }]}>
                {t === 'text' ? 'Text' : t === 'image' ? 'Photo' : 'Video'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={csStyles.body} keyboardShouldPersistTaps="handled">
          {storyType === 'text' && (
            <>
              <View style={[csStyles.textPreview, { backgroundColor: selectedBg }]}>
                <TextInput
                  style={csStyles.textInput}
                  placeholder="Type your story..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  multiline
                  maxLength={300}
                  value={textContent}
                  onChangeText={setTextContent}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={csStyles.bgRow}>
                {STORY_BG_COLORS.map((bg) => (
                  <TouchableOpacity
                    key={bg}
                    style={[csStyles.bgDot, { backgroundColor: bg }, selectedBg === bg && { borderWidth: 3, borderColor: C.primary }]}
                    onPress={() => setSelectedBg(bg)}
                  />
                ))}
              </ScrollView>
            </>
          )}

          {storyType === 'image' && (
            <>
              {mediaUri ? (
                <View style={csStyles.mediaPreview}>
                  <Image source={{ uri: mediaUri }} style={csStyles.mediaImage} resizeMode="cover" />
                  <TouchableOpacity style={csStyles.changeBtn} onPress={pickImage}>
                    <Ionicons name="swap-horizontal" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[csStyles.pickBtn, { backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant }]} onPress={pickImage}>
                  <Ionicons name="image-outline" size={40} color={C.primary} />
                  <Text style={[csStyles.pickText, { color: C.onSurfaceVariant }]}>Tap to select a photo</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {storyType === 'video' && (
            <>
              {mediaUri ? (
                <View style={csStyles.mediaPreview}>
                  <PreviewVideo
                    uri={mediaUri}
                    style={csStyles.mediaImage}
                  />
                  <TouchableOpacity style={csStyles.changeBtn} onPress={pickVideo}>
                    <Ionicons name="swap-horizontal" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[csStyles.pickBtn, { backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant }]} onPress={pickVideo}>
                  <Ionicons name="videocam-outline" size={40} color={C.primary} />
                  <Text style={[csStyles.pickText, { color: C.onSurfaceVariant }]}>Tap to select a video (max 30s)</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {(storyType === 'image' || storyType === 'video') && mediaUri && (
            <TextInput
              style={[csStyles.captionInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
              placeholder="Add a caption (optional)..."
              placeholderTextColor={C.onSurfaceVariant}
              value={caption}
              onChangeText={setCaption}
              maxLength={200}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const csStyles = StyleSheet.create({
  modal: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing[5], borderBottomWidth: 1,
  },
  cancelText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  postBtn: { borderRadius: Radius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  postBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md },
  typeRow: { flexDirection: 'row', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], gap: Spacing[2] },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.full,
  },
  typeText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  body: { padding: Spacing[5], gap: Spacing[4] },
  textPreview: {
    width: '100%', height: 320, borderRadius: 20, padding: Spacing[5],
    justifyContent: 'center', alignItems: 'center',
  },
  textInput: {
    fontFamily: Typography.fontFamily.bold, fontSize: 24, color: '#fff',
    textAlign: 'center', width: '100%',
  },
  bgRow: { gap: Spacing[3], paddingVertical: Spacing[2] },
  bgDot: { width: 36, height: 36, borderRadius: 18 },
  mediaPreview: { width: '100%', height: 400, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  mediaImage: { width: '100%', height: '100%' },
  changeBtn: {
    position: 'absolute', bottom: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  pickBtn: {
    width: '100%', height: 300, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', gap: Spacing[3],
    borderWidth: 2, borderStyle: 'dashed',
  },
  pickText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },
  captionInput: {
    fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md,
    borderRadius: Radius.xl, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
  },
});

// ─── Comment Sheet Modal ─────────────────────────────────────────────
interface CommentSheetProps {
  visible: boolean;
  postId: string;
  onClose: () => void;
  user: any;
  authorName: string;
  authorPhotoURL?: string;
  postAuthorId?: string;
  highlightCommentId?: string | null;
  onCommentNotify?: (postId: string, commentText: string, commentId?: string) => void;
}

const CommentSheet: React.FC<CommentSheetProps> = ({
  visible,
  postId,
  onClose,
  user,
  authorName,
  authorPhotoURL,
  postAuthorId,
  highlightCommentId,
  onCommentNotify,
}) => {
  const C = useColors();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !postId) return;
    const unsub = subscribeToPostComments(postId, setComments);
    return unsub;
  }, [visible, postId]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setText('');
    try {
      const commentId = await addPostComment(postId, {
        authorId: user.uid,
        authorName,
        authorPhotoURL: authorPhotoURL || null,
        text: msg,
      });
      // Send notification to post author
      if (onCommentNotify) {
        onCommentNotify(postId, msg, commentId);
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e) {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  const canDeleteComment = (comment: PostComment) =>
    !!user && !!comment.id && (comment.authorId === user.uid || postAuthorId === user.uid);

  const handleDeleteComment = (comment: PostComment) => {
    if (!comment.id || !postId || !canDeleteComment(comment)) return;

    Alert.alert('Delete Comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePostComment(postId, comment.id!);
          } catch {
            Alert.alert('Error', 'Could not delete comment.');
          }
        },
      },
    ]);
  };

  useEffect(() => {
    if (!visible || !highlightCommentId || comments.length === 0) return;
    const index = comments.findIndex((comment) => comment.id === highlightCommentId);
    if (index < 0) return;
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.4 });
    }, 250);
  }, [comments, highlightCommentId, visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[cmStyles.header, { borderBottomColor: C.outlineVariant + '33' }]}>
          <Text style={[cmStyles.title, { color: C.onSurface }]}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={C.onSurface} />
          </TouchableOpacity>
        </View>
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={item => item.id || Math.random().toString()}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 300);
          }}
          renderItem={({ item }) => (
            <View style={cmStyles.commentRow}>
              <Avatar name={item.authorName} uri={item.authorPhotoURL || undefined} size={32} />
              <View
                style={[
                  cmStyles.commentBubble,
                  { backgroundColor: item.id === highlightCommentId ? C.primaryContainer : C.surfaceContainerLow },
                ]}
              >
                <View style={cmStyles.commentTopRow}>
                  <Text translate={false} style={[cmStyles.commentAuthor, { color: C.primary }]}>{item.authorName}</Text>
                  {canDeleteComment(item) ? (
                    <TouchableOpacity onPress={() => handleDeleteComment(item)} hitSlop={8} activeOpacity={0.65}>
                      <Ionicons name="trash-outline" size={15} color={C.error} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text translate={false} style={[cmStyles.commentText, { color: C.onSurface }]}>{item.text}</Text>
                <Text style={[cmStyles.commentTime, { color: C.onSurfaceVariant }]}>
                  {item.createdAt?.toDate ? timeAgo(item.createdAt.toDate()) : 'just now'}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={cmStyles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={cmStyles.emptyWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={C.outlineVariant} />
              <Text style={[cmStyles.emptyText, { color: C.onSurfaceVariant }]}>No comments yet.{'\n'}Start the conversation!</Text>
            </View>
          }
        />
        <View style={[cmStyles.inputRow, { backgroundColor: C.surfaceContainerLow, borderTopColor: C.outlineVariant + '33' }]}>
          <TextInput
            style={[cmStyles.input, { backgroundColor: C.surfaceContainerHighest, color: C.onSurface }]}
            placeholder="Write a comment..."
            placeholderTextColor={C.onSurfaceVariant}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[cmStyles.sendBtn, { backgroundColor: C.primary }, !text.trim() && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={18} color={C.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const cmStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing[5], paddingTop: 20, paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  list: { padding: Spacing[4], gap: Spacing[3], paddingBottom: 20 },
  commentRow: { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start' },
  commentBubble: { flex: 1, borderRadius: 16, padding: Spacing[3], gap: 3 },
  commentTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing[2] },
  commentAuthor: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  commentText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.5 },
  commentTime: { fontFamily: Typography.fontFamily.regular, fontSize: 11 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing[3] },
  emptyText: { textAlign: 'center', fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[3],
    padding: Spacing[4], borderTopWidth: 1,
  },
  input: {
    flex: 1, borderRadius: Radius.xl, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
});

// ─── Main Community Feed Screen ──────────────────────────────────────
export const CommunityFeedScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = useColors();
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const currentDisplayName = getProfileDisplayName(profile, user?.displayName || 'Anonymous');
  const currentPhotoURL = getProfilePhotoURL(profile, user?.photoURL);
  const savedPostIds = usePostStore((state) => state.savedPostIds);
  const toggleSave = usePostStore((state) => state.toggleSave);
  const loadSaved = usePostStore((state) => state.loadSaved);
  const getFeedCache = usePostStore((state) => state.getFeedCache);
  const setFeedCache = usePostStore((state) => state.setFeedCache);
  const [activeTab, setActiveTab] = useState<FeedTab>('Trending');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedCursor, setFeedCursor] = useState<FeedCursor | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [refreshingFeed, setRefreshingFeed] = useState(false);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [viewingStoryGroup, setViewingStoryGroup] = useState<{ authorId: string; authorName: string; authorPhotoURL?: string | null; stories: Story[] } | null>(null);

  const [postText, setPostText] = useState('');
  const [isVentMode, setIsVentMode] = useState(false);
  const [postImage, setPostImage] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [newPostCategory, setNewPostCategory] = useState('General');
  const [showNewCategoryDropdown, setShowNewCategoryDropdown] = useState(false);
  const canSubmitPost = postText.trim().length > 0 || !!postImage;

  // Stories
  const [stories, setStories] = useState<Story[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [seenAuthors, setSeenAuthors] = useState<Record<string, number>>({}); // authorId -> last seen timestamp

  // 3-dot menu
  const [menuPost, setMenuPost] = useState<Post | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Edit post
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState('');

  // Comments sheet
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const handledNotificationTargetRef = useRef<string | null>(null);
  const [pendingReactions, setPendingReactions] = useState<Record<string, boolean>>({});
  const pendingReactionsRef = useRef<Record<string, boolean>>({});
  const pendingFeedCacheWriteRef = useRef<string | null>(null);

  // Background story posting
  const handleStoryPostInBackground = useCallback((task: () => Promise<void>) => {
    task()
      .then(() => {
        Alert.alert(t('\u2705 Story Posted'), t('Your story is now live!'));
      })
      .catch((e) => {
        console.error('Story posting error:', e);
        Alert.alert(t('Failed'), t('Could not post story. Please try again.'));
      });
  }, [t]);

  useEffect(() => { loadSaved(); }, []);

  useEffect(() => {
    pendingReactionsRef.current = pendingReactions;
  }, [pendingReactions]);

  const friendIdKey = useMemo(() => friendIds.slice().sort().join('|'), [friendIds]);
  const feedCacheKey = useMemo(
    () => getFeedCacheKey(activeTab, selectedCategory, user?.uid),
    [activeTab, selectedCategory, user?.uid]
  );

  const appendUniquePosts = useCallback((current: Post[], next: Post[]) => {
    const existingIds = new Set(current.map((post) => post.id).filter(Boolean));
    return [
      ...current,
      ...next.filter((post) => post.id && !existingIds.has(post.id)),
    ];
  }, []);

  const subscribedPostIdKey = useMemo(
    () => posts.map((post) => post.id).filter(Boolean).sort().join('|'),
    [posts]
  );

  useEffect(() => {
    if (pendingFeedCacheWriteRef.current !== feedCacheKey) return;
    pendingFeedCacheWriteRef.current = null;
    setFeedCache(feedCacheKey, posts);
  }, [feedCacheKey, posts, setFeedCache]);

  const refreshFeed = useCallback(async (showRefresh = false) => {
    const cachedFeed = getFeedCache(feedCacheKey);
    if (showRefresh) setRefreshingFeed(true);
    else setLoadingFeed(!cachedFeed?.posts.length);

    try {
      const page = await fetchFeedPage({
        mode: activeTab,
        category: selectedCategory,
        friendIds,
        userId: user?.uid,
        pageSize: FEED_PAGE_SIZE,
      });
      setPosts(page.posts);
      setFeedCache(feedCacheKey, page.posts);
      setFeedCursor(page.cursor);
    } catch (error) {
      console.warn('Failed to load feed:', error);
      Alert.alert('Feed Error', 'Could not load the community feed. Please try again.');
    } finally {
      setLoadingFeed(false);
      setRefreshingFeed(false);
    }
  }, [activeTab, feedCacheKey, friendIdKey, getFeedCache, selectedCategory, setFeedCache, user?.uid]);

  const loadMoreFeed = useCallback(async () => {
    if (loadingFeed || loadingMoreFeed || refreshingFeed || !feedCursor?.hasMore) return;

    setLoadingMoreFeed(true);
    try {
      const page = await fetchFeedPage({
        mode: activeTab,
        category: selectedCategory,
        friendIds,
        userId: user?.uid,
        pageSize: FEED_PAGE_SIZE,
        cursor: feedCursor,
      });
      setPosts((current) => {
        const next = appendUniquePosts(current, page.posts);
        pendingFeedCacheWriteRef.current = feedCacheKey;
        return next;
      });
      setFeedCursor(page.cursor);
    } catch (error) {
      console.warn('Failed to load more feed posts:', error);
    } finally {
      setLoadingMoreFeed(false);
    }
  }, [
    activeTab,
    appendUniquePosts,
    feedCacheKey,
    feedCursor,
    friendIdKey,
    loadingFeed,
    loadingMoreFeed,
    refreshingFeed,
    selectedCategory,
    setFeedCache,
    user?.uid,
  ]);

  useEffect(() => {
    const cachedFeed = getFeedCache(feedCacheKey);
    if (cachedFeed?.posts.length) {
      setPosts(cachedFeed.posts);
      setLoadingFeed(false);
    } else {
      setPosts([]);
      setLoadingFeed(true);
    }
  }, [feedCacheKey, getFeedCache]);

  useEffect(() => {
    refreshFeed(false);
  }, [refreshFeed]);

  useEffect(() => {
    if (!subscribedPostIdKey) return;

    const postIds = subscribedPostIdKey.split('|').filter(Boolean);
    return subscribeToPostUpdates(
      postIds,
      (updatedPosts, removedPostIds) => {
        if (!updatedPosts.length && !removedPostIds.length) return;

        setPosts((current) => {
          const updates = new Map(updatedPosts.map((post) => [post.id, post]));
          const removed = new Set(removedPostIds);
          const next = current
            .filter((post) => !post.id || !removed.has(post.id))
            .map((post) => {
              const updated = post.id ? updates.get(post.id) : undefined;
              if (!updated || !post.id) return post;
              const pending = pendingReactionsRef.current;
              const keepLikes = !!pending[`${post.id}:likes`];
              const keepSolidarity = !!pending[`${post.id}:solidarity`];

              return {
                ...post,
                ...updated,
                ...(keepLikes ? {
                  likes: post.likes,
                  likesCount: post.likesCount,
                } : {}),
                ...(keepSolidarity ? {
                  solidarity: post.solidarity,
                  solidarityCount: post.solidarityCount,
                } : {}),
                ...(keepLikes || keepSolidarity ? { engagementScore: post.engagementScore } : {}),
              };
            })
            .filter((post) => {
              if (!post.id || post.hidden) return false;
              if (user?.uid && Array.isArray(post.hiddenBy) && post.hiddenBy.includes(user.uid)) {
                return false;
              }
              if (
                selectedCategory !== 'All'
                && (post.category || 'General').toLowerCase() !== selectedCategory.toLowerCase()
              ) {
                return false;
              }
              return true;
            });

          pendingFeedCacheWriteRef.current = feedCacheKey;
          return next;
        });
      },
      (error) => console.warn('Failed to sync feed post updates:', error)
    );
  }, [feedCacheKey, selectedCategory, setFeedCache, subscribedPostIdKey, user?.uid]);

  useEffect(() => {
    const openCommentsPostId = route.params?.openCommentsPostId;
    if (!openCommentsPostId) return;

    const targetKey = `${openCommentsPostId}-${route.params?.notificationNonce || ''}`;
    if (handledNotificationTargetRef.current === targetKey) return;

    handledNotificationTargetRef.current = targetKey;
    setCommentPostId(openCommentsPostId);
    setHighlightCommentId(route.params?.highlightCommentId || null);
    setShowComments(true);
  }, [route.params?.highlightCommentId, route.params?.openCommentsPostId, route.params?.notificationNonce]);

  useEffect(() => {
    const unsub = subscribeToStories(setStories);
    return unsub;
  }, []);

  // Load accepted friend IDs for friends-only story filtering
  useEffect(() => {
    if (!user) {
      setFriendIds([]);
      return;
    }
    getAcceptedFriendIds(user.uid).then(setFriendIds).catch(() => setFriendIds([]));
  }, [user]);

  // Load seen story state from AsyncStorage
  useEffect(() => {
    if (!user) return;
    AsyncStorage.getItem(`@seen_stories_${user.uid}`)
      .then(val => { if (val) setSeenAuthors(JSON.parse(val)); })
      .catch(() => {});
  }, [user]);

  // Save seen story state
  const persistSeen = (updated: Record<string, number>) => {
    if (!user) return;
    setSeenAuthors(updated);
    AsyncStorage.setItem(`@seen_stories_${user.uid}`, JSON.stringify(updated)).catch(() => {});
  };

  // Called when user opens a story group
  const handleStoryViewed = useCallback((authorId: string) => {
    setSeenAuthors(prev => {
      const updated = { ...prev, [authorId]: Date.now() };
      if (user) {
        AsyncStorage.setItem(`@seen_stories_${user.uid}`, JSON.stringify(updated)).catch(() => {});
      }
      return updated;
    });
  }, [user]);

  // Check if a story group is unseen
  const isStoryUnseen = (group: { authorId: string; stories: Story[] }): boolean => {
    const lastSeen = seenAuthors[group.authorId];
    if (!lastSeen) return true; // never seen
    // Check if any story in the group was created after the last seen time
    const latestStory = group.stories[group.stories.length - 1];
    if (!latestStory?.createdAt?.toMillis) return true;
    return latestStory.createdAt.toMillis() > lastSeen;
  };

  // Delete all stories handler
  const handleDeleteAllStories = () => {
    if (!user) return;
    Alert.alert('Delete All Stories', 'Are you sure you want to delete all your stories?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive', onPress: async () => {
          try {
            await deleteAllStoriesByAuthor(user.uid);
          } catch {
            Alert.alert('Error', 'Could not delete stories.');
          }
        },
      },
    ]);
  };

  const storyGroups = groupStoriesByAuthor(stories);
  const myStories = storyGroups.find((g) => g.authorId === user?.uid);
  // Friends-only filter: show only stories from accepted friends
  const otherStories = storyGroups.filter((g) => g.authorId !== user?.uid && friendIds.includes(g.authorId));

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPostImage(result.assets[0].uri);
      setShowCreatePost(true);
    }
  };

  const handlePost = async () => {
    const trimmedText = postText.trim();
    if (!trimmedText && !postImage) { Alert.alert('Empty post', 'Write a caption or add a photo first!'); return; }
    if (!user) { Alert.alert('Sign in required'); return; }
    setPosting(true);
    try {
      // Upload image to Firebase Storage if present
      let uploadedImageUrl = postImage;
      if (postImage) {
        const ext = getExtensionFromUri(postImage);
        const path = getMediaPath('posts', user.uid, ext);
        uploadedImageUrl = await uploadMedia(postImage, path, 'image');
      }

      await createPost({
        authorId: user.uid,
        authorName: isVentMode ? 'Anonymous' : currentDisplayName,
        authorPhotoURL: isVentMode ? null : currentPhotoURL || null,
        content: trimmedText,
        category: newPostCategory,
        isVentMode,
        ...(uploadedImageUrl ? { imageUrl: uploadedImageUrl } : {}),
      });
      setPostText(''); setPostImage(null); setIsVentMode(false); setNewPostCategory('General'); setShowCreatePost(false);
      refreshFeed(false);
    } catch (e) {
      Alert.alert('Error', 'Could not post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const updatePostReaction = useCallback((postId: string, field: ReactionField, active: boolean) => {
    if (!user) return;
    setPosts((current) => {
      return current.map((post) =>
        post.id === postId ? applyPostReaction(post, user.uid, field, active) : post
      );
    });
  }, [user?.uid]);

  const setReactionPending = (postId: string, field: ReactionField, pending: boolean) => {
    const key = `${postId}:${field}`;
    setPendingReactions((current) => {
      if (pending) return { ...current, [key]: true };
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const isReactionPending = (postId: string | undefined, field: ReactionField) =>
    !!postId && !!pendingReactions[`${postId}:${field}`];

  // Post Actions
  const handleLike = async (post: Post) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (!post.id || isReactionPending(post.id, 'likes')) return;
    const liked = hasUserReaction(post, 'likes', user.uid);
    const nextActive = !liked;
    setReactionPending(post.id, 'likes', true);
    updatePostReaction(post.id, 'likes', nextActive);
    try {
      await toggleLike(post.id!, user.uid, liked);
      // Send notification to post author (only if it's a new like, not unlike)
      if (!liked && post.authorId !== user.uid) {
        createNotification(post.authorId, {
          type: 'like',
          text: `${currentDisplayName} liked your post`,
          fromUserId: user.uid,
          fromUserName: currentDisplayName,
          postId: post.id,
        }).catch(() => {});
      }
    } catch (e) {
      updatePostReaction(post.id, 'likes', liked);
      Alert.alert('Error', 'Could not update like. Please try again.');
    } finally {
      setReactionPending(post.id, 'likes', false);
    }
  };

  const handleSolidarity = async (post: Post) => {
    if (!user) { Alert.alert('Sign in required'); return; }
    if (!post.id || isReactionPending(post.id, 'solidarity')) return;
    const active = hasUserReaction(post, 'solidarity', user.uid);
    const nextActive = !active;
    setReactionPending(post.id, 'solidarity', true);
    updatePostReaction(post.id, 'solidarity', nextActive);
    try {
      await toggleSolidarity(post.id!, user.uid, active);
      if (!active && post.authorId !== user.uid) {
        createNotification(post.authorId, {
          type: 'solidarity',
          text: `${currentDisplayName} sent solidarity on your post`,
          fromUserId: user.uid,
          fromUserName: currentDisplayName,
          postId: post.id,
        }).catch(() => {});
      }
    } catch (e) {
      updatePostReaction(post.id, 'solidarity', active);
      Alert.alert('Error', 'Could not update solidarity. Please try again.');
    } finally {
      setReactionPending(post.id, 'solidarity', false);
    }
  };

  const openPostDetail = (post: Post) => {
    if (!post.id) return;
    navigation.navigate('PostDetail', { postId: post.id });
  };

  const handleComment = (post: Post) => {
    setCommentPostId(post.id!);
    setHighlightCommentId(null);
    setShowComments(true);
  };

  const handleShare = async (post: Post) => {
    if (!post.id) return;
    try {
      const caption = post.content?.trim();
      const postUrl = getPostShareUrl(post.id);
      await RNShare.share({
        message: caption
          ? `"${caption}"\n\n${postUrl}\n\n- ${post.authorName} on Mindspace`
          : `${post.authorName} shared a photo on Mindspace\n\n${postUrl}`,
        url: postUrl,
      });
    } catch (e) { /* user cancelled */ }
  };

  const handleProfileTap = (post: Post) => {
    if (post.isVentMode) return;
    if (user && post.authorId === user.uid) {
      navigation.navigate('ProfileTab');
    } else {
      // Navigate to ViewProfile for other users
      navigation.navigate('ViewProfile', { userId: post.authorId, userName: post.authorName });
    }
  };

  // 3-dot menu
  const openMenu = (post: Post) => { setMenuPost(post); setShowMenu(true); };

  const handleEditPost = () => {
    if (!menuPost) return;
    setShowMenu(false);
    setEditingPost(menuPost);
    setEditText(menuPost.content || '');
  };

  const submitEdit = async () => {
    if (!editingPost) return;
    const nextContent = editText.trim();
    if (!nextContent && !editingPost.imageUrl) return;
    try {
      await updatePost(editingPost.id!, { content: nextContent });
      setPosts((current) => current.map((post) =>
        post.id === editingPost.id ? { ...post, content: nextContent } : post
      ));
      setEditingPost(null);
      setEditText('');
    } catch (e) {
      Alert.alert('Error', 'Could not update post.');
    }
  };

  const handleDeletePost = () => {
    if (!menuPost) return;
    setShowMenu(false);
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deletePost(menuPost.id!);
            setPosts((current) => current.filter((post) => post.id !== menuPost.id));
          } catch (e) { Alert.alert('Error', 'Could not delete.'); }
        },
      },
    ]);
  };

  const handleHidePost = async () => {
    if (!menuPost || !user) return;
    setShowMenu(false);
    try {
      await hidePostForUser(menuPost.id!, user.uid);
      setPosts((current) => current.filter((post) => post.id !== menuPost.id));
    } catch (e) { Alert.alert('Error', 'Could not hide post.'); }
  };

  const handleSavePost = () => {
    if (!menuPost) return;
    setShowMenu(false);
    toggleSave(menuPost.id!);
  };

  // ─── Render Post Card ─────────────────────────────────────────
  const renderPost = ({ item }: { item: Post }) => {
    const liked = hasUserReaction(item, 'likes', user?.uid);
    const solidarityActive = hasUserReaction(item, 'solidarity', user?.uid);
    const likesCount = getReactionCount(item, 'likes');
    const solidarityCount = getReactionCount(item, 'solidarity');
    const commentsCount = item.commentsCount || item.comments || 0;
    const likePending = isReactionPending(item.id, 'likes');
    const solidarityPending = isReactionPending(item.id, 'solidarity');

    return (
      <View
        style={[
          styles.postCard,
          { backgroundColor: item.isVentMode ? (C.surface === '#141412' ? '#2a1f1f' : '#fff0f0') : C.surfaceContainerLow },
          item.isVentMode && { borderWidth: 1, borderColor: '#f4a9b033' },
        ]}
      >
        <View style={styles.postHeader}>
          <TouchableOpacity
            style={styles.postAuthorRow}
            onPress={() => handleProfileTap(item)}
            activeOpacity={item.isVentMode ? 1 : 0.7}
          >
            <Avatar
              name={item.isVentMode ? '?' : item.authorName}
              uri={!item.isVentMode ? (item.authorPhotoURL || (user && item.authorId === user.uid ? currentPhotoURL : undefined)) : undefined}
              size={38}
            />
            <View style={styles.postMeta}>
              <View style={styles.postNameRow}>
                <Text translate={false} style={[styles.postAuthor, { color: C.onSurface }]}>
                  {item.isVentMode ? 'Anonymous' : item.authorName}
                </Text>
                {item.isVentMode && (
                  <View style={styles.ventBadge}><Text style={styles.ventBadgeText}>VENT</Text></View>
                )}
              </View>
              <Text style={[styles.postTime, { color: C.onSurfaceVariant }]}>
                {item.createdAt?.toDate ? timeAgo(item.createdAt.toDate()) : 'just now'} • {item.category || 'General'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn} onPress={() => openMenu(item)}>
            <Ionicons name="ellipsis-horizontal" size={18} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.82} onPress={() => openPostDetail(item)}>
          {item.content?.trim() ? (
            <Text
              translate={false}
              style={[styles.postContent, { color: C.onSurface }]}
              numberOfLines={3}
              ellipsizeMode="tail"
            >
              {item.content}
            </Text>
          ) : null}

          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
          ) : null}
        </TouchableOpacity>

        {/* Post Actions */}
        <View style={[styles.postActions, { borderTopColor: C.outlineVariant + '44' }]}>
          <TouchableOpacity style={[styles.actionBtn, likePending && { opacity: 0.65 }]} onPress={() => handleLike(item)} activeOpacity={0.65} disabled={likePending}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? C.primary : C.onSurfaceVariant} />
            <Text style={[styles.actionText, { color: liked ? C.primary : C.onSurfaceVariant }]}>{likesCount > 0 ? likesCount : ''} Like</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, solidarityPending && { opacity: 0.65 }]} onPress={() => handleSolidarity(item)} activeOpacity={0.65} disabled={solidarityPending}>
            <Ionicons name={solidarityActive ? 'hand-left' : 'hand-left-outline'} size={18} color={solidarityActive ? C.primary : C.onSurfaceVariant} />
            <Text style={[styles.actionText, { color: solidarityActive ? C.primary : C.onSurfaceVariant }]}>{solidarityCount > 0 ? solidarityCount : ''} Solidarity</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openPostDetail(item)} activeOpacity={0.65}>
            <Ionicons name="chatbubble-outline" size={16} color={C.onSurfaceVariant} />
            <Text style={[styles.actionText, { color: C.onSurfaceVariant }]}>{commentsCount > 0 ? commentsCount : ''} Comment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)} activeOpacity={0.65}>
            <Ionicons name="share-social-outline" size={16} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const canSaveEdit = !!editingPost && (editText.trim().length > 0 || !!editingPost.imageUrl);

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <StatusBar style={C.surface === '#141412' ? 'light' : 'dark'} />

      {viewingStoryGroup && (
        <StoryViewer
          storyGroup={viewingStoryGroup}
          onClose={() => setViewingStoryGroup(null)}
          currentUserId={user?.uid}
          onStoryViewed={handleStoryViewed}
        />
      )}
      <CreateStoryModal
        visible={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onPostInBackground={handleStoryPostInBackground}
        user={user}
        authorName={currentDisplayName}
        authorPhotoURL={currentPhotoURL}
      />
      <CommentSheet
        visible={showComments}
        postId={commentPostId || ''}
        postAuthorId={posts.find((p) => p.id === commentPostId)?.authorId}
        highlightCommentId={highlightCommentId}
        onClose={() => { setShowComments(false); setCommentPostId(null); setHighlightCommentId(null); }}
        user={user}
        authorName={currentDisplayName}
        authorPhotoURL={currentPhotoURL}
        onCommentNotify={(pId, commentText, commentId) => {
          // Find the post to get author
          const post = posts.find(p => p.id === pId);
          if (post && user && post.authorId !== user.uid) {
            createNotification(post.authorId, {
              type: 'comment',
              text: `${currentDisplayName} commented: "${commentText.substring(0, 50)}"`,
              fromUserId: user.uid,
              fromUserName: currentDisplayName,
              postId: pId,
              commentId,
            }).catch(() => {});
          }
        }}
      />

      {/* 3-dot Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { backgroundColor: C.surface }]}>
            {menuPost && user && menuPost.authorId === user.uid ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleEditPost}>
                  <Ionicons name="pencil-outline" size={20} color={C.onSurface} />
                  <Text style={[styles.menuText, { color: C.onSurface }]}>Edit Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleSavePost}>
                  <Ionicons name={menuPost && savedPostIds.includes(menuPost.id!) ? 'bookmark' : 'bookmark-outline'} size={20} color={C.onSurface} />
                  <Text style={[styles.menuText, { color: C.onSurface }]}>
                    {menuPost && savedPostIds.includes(menuPost.id!) ? 'Unsave Post' : 'Save Post'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDeletePost}>
                  <Ionicons name="trash-outline" size={20} color="#e57373" />
                  <Text style={[styles.menuText, { color: '#e57373' }]}>Delete Post</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={handleSavePost}>
                  <Ionicons name={menuPost && savedPostIds.includes(menuPost.id!) ? 'bookmark' : 'bookmark-outline'} size={20} color={C.onSurface} />
                  <Text style={[styles.menuText, { color: C.onSurface }]}>
                    {menuPost && savedPostIds.includes(menuPost.id!) ? 'Unsave Post' : 'Save Post'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleHidePost}>
                  <Ionicons name="eye-off-outline" size={20} color={C.onSurface} />
                  <Text style={[styles.menuText, { color: C.onSurface }]}>Hide Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setShowMenu(false);
                  Alert.alert('Reported', 'Thank you for reporting. We will review this post.');
                }}>
                  <Ionicons name="flag-outline" size={20} color="#e57373" />
                  <Text style={[styles.menuText, { color: '#e57373' }]}>Report</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: C.outlineVariant + '33' }]} onPress={() => setShowMenu(false)}>
              <Text style={[styles.menuText, { color: C.onSurfaceVariant, textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Post Modal */}
      <Modal visible={!!editingPost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingPost(null)}>
        <KeyboardAvoidingView style={[csStyles.modal, { backgroundColor: C.surface }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[csStyles.header, { borderBottomColor: C.outlineVariant + '44' }]}>
            <TouchableOpacity onPress={() => setEditingPost(null)}>
              <Text style={[csStyles.cancelText, { color: C.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[csStyles.title, { color: C.onSurface }]}>Edit Post</Text>
            <TouchableOpacity
              style={[csStyles.postBtn, { backgroundColor: C.primary }, !canSaveEdit && { opacity: 0.6 }]}
              onPress={submitEdit}
              disabled={!canSaveEdit}
            >
              <Text style={[csStyles.postBtnText, { color: C.onPrimary }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: Spacing[5] }}>
            <TextInput
              style={[styles.createInput, { color: C.onSurface }]}
              placeholder="Edit your post..."
              placeholderTextColor={C.onSurfaceVariant}
              multiline
              value={editText}
              onChangeText={setEditText}
              autoFocus
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Post Modal */}
      <Modal visible={showCreatePost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreatePost(false)}>
        <KeyboardAvoidingView style={[csStyles.modal, { backgroundColor: C.surface }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[csStyles.header, { borderBottomColor: C.outlineVariant + '44' }]}>
            <TouchableOpacity onPress={() => setShowCreatePost(false)}>
              <Text style={[csStyles.cancelText, { color: C.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[csStyles.title, { color: C.onSurface }]}>Share with Community</Text>
            <TouchableOpacity
              style={[csStyles.postBtn, { backgroundColor: C.primary }, (posting || !canSubmitPost) && { opacity: 0.6 }]}
              onPress={handlePost}
              disabled={posting || !canSubmitPost}
            >
              <Text style={[csStyles.postBtnText, { color: C.onPrimary }]}>{posting ? 'Posting...' : 'POST'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: Spacing[5] }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[5] }}>
              <Avatar name={currentDisplayName || '?'} uri={currentPhotoURL} size={40} />
              <TextInput
                style={[styles.createInput, { color: C.onSurface }]}
                placeholder="Share your thoughts with the community..."
                placeholderTextColor={C.onSurfaceVariant}
                multiline
                value={postText}
                onChangeText={setPostText}
                autoFocus
              />
            </View>

            {postImage && (
              <View style={{ marginBottom: Spacing[4] }}>
                <Image source={{ uri: postImage }} style={{ width: '100%', height: 220, borderRadius: 16 }} resizeMode="cover" />
                <TouchableOpacity style={{ position: 'absolute', top: 8, right: 8 }} onPress={() => setPostImage(null)}>
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.createTools, { borderTopColor: C.outlineVariant + '44' }]}>
              <TouchableOpacity style={[styles.toolBtn, { backgroundColor: C.surfaceContainerLow }]} onPress={pickImage}>
                <Ionicons name="image-outline" size={22} color={C.primary} />
                <Text style={[styles.toolText, { color: C.onSurface }]}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ventToggle, isVentMode && styles.ventToggleOn]}
                onPress={() => setIsVentMode(v => !v)}
              >
                <Ionicons name="flame-outline" size={18} color={isVentMode ? '#fff' : '#e57373'} />
                <Text style={[styles.ventToggleText, isVentMode && { color: '#fff' }]}>VENT MODE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: C.surfaceContainerLow, marginLeft: 'auto' }]}
                onPress={() => setShowNewCategoryDropdown(true)}
              >
                <Text style={[styles.toolText, { color: C.primary }]}>{newPostCategory}</Text>
                <Ionicons name="chevron-down" size={16} color={C.primary} />
              </TouchableOpacity>
            </View>

            {isVentMode && (
              <View style={styles.ventInfo}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#e57373" />
                <Text style={styles.ventInfoText}>
                  Your post will appear as "Anonymous". Your identity is fully hidden from others.
                </Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* New Post Category Dropdown */}
        <Modal visible={showNewCategoryDropdown} transparent animationType="fade" onRequestClose={() => setShowNewCategoryDropdown(false)}>
          <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowNewCategoryDropdown(false)}>
            <ScrollView style={[styles.categoryDropdown, { backgroundColor: C.surface, maxHeight: 400 }]}>
              <Text style={[styles.categoryDropdownTitle, { color: C.onSurface }]}>Select Category</Text>
              {CATEGORIES.filter(c => c !== 'All').map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryItem,
                    newPostCategory === cat && { backgroundColor: C.primaryContainer },
                  ]}
                  onPress={() => {
                    setNewPostCategory(cat);
                    setShowNewCategoryDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.categoryItemText,
                    { color: newPostCategory === cat ? C.onPrimaryContainer : C.onSurface },
                  ]}>{cat}</Text>
                  {newPostCategory === cat && <Ionicons name="checkmark" size={18} color={C.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </Modal>
      </Modal>

      {/* Category Dropdown Modal */}
      <Modal visible={showCategoryDropdown} transparent animationType="fade" onRequestClose={() => setShowCategoryDropdown(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowCategoryDropdown(false)}>
          <View style={[styles.categoryDropdown, { backgroundColor: C.surface, maxHeight: 480 }]}>
            <Text style={[styles.categoryDropdownTitle, { color: C.onSurface }]}>Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryItem,
                    selectedCategory === cat && { backgroundColor: C.primaryContainer },
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setShowCategoryDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.categoryItemText,
                    { color: selectedCategory === cat ? C.onPrimaryContainer : C.onSurface },
                  ]}>{cat}</Text>
                  {selectedCategory === cat && <Ionicons name="checkmark" size={18} color={C.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        data={posts}
        keyExtractor={item => item.id || Math.random().toString()}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        refreshing={refreshingFeed}
        onRefresh={() => refreshFeed(true)}
        onEndReached={loadMoreFeed}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={
          <View>
            {/* HEADER */}
            <View style={styles.header}>
              <View style={styles.logoRow}>
                <Image source={APP_LOGO} style={styles.logoMarkImg} />
                <Text style={[styles.logoText, { color: C.primary }]}>mindspace</Text>
              </View>
              <AppHeaderActions />
            </View>

            {/* STORIES */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
              <TouchableOpacity style={styles.storyBubbleWrap} onPress={() => setShowCreateStory(true)} activeOpacity={0.8}>
                <View style={[styles.storyBubble, { backgroundColor: C.primaryContainer, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="add" size={28} color={C.primary} />
                </View>
                <Text style={[styles.storyName, { color: C.onSurfaceVariant }]}>Add Story</Text>
              </TouchableOpacity>

              {myStories && (() => {
                const latest = myStories.stories[myStories.stories.length - 1];
                const coverBg = latest?.backgroundColor || '#2d6a4f';
                return (
                  <TouchableOpacity
                    style={styles.storyBubbleWrap}
                    onPress={() => setViewingStoryGroup(myStories)}
                    onLongPress={handleDeleteAllStories}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.storyBubble, { backgroundColor: coverBg }]}>
                      <StoryCover story={latest} />
                    </View>
                    <Text style={[styles.storyName, { color: C.onSurfaceVariant }]}>You</Text>
                  </TouchableOpacity>
                );
              })()}

              {otherStories.map(group => {
                const latest = group.stories[group.stories.length - 1];
                const coverBg = latest?.backgroundColor || '#264653';
                const unseen = isStoryUnseen(group);
                return (
                  <TouchableOpacity key={group.authorId} style={styles.storyBubbleWrap} onPress={() => setViewingStoryGroup(group)} activeOpacity={0.8}>
                    <View style={[
                      styles.storyBubble,
                      { backgroundColor: coverBg },
                      unseen ? styles.storyRingUnseen : styles.storyRingSeen,
                    ]}>
                      <StoryCover story={latest} />
                    </View>
                    <Text translate={false} style={[styles.storyName, { color: C.onSurfaceVariant }]} numberOfLines={1}>{group.authorName.split(' ')[0]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* CREATE POST BOX */}
            <TouchableOpacity activeOpacity={0.9} onPress={() => setShowCreatePost(true)}>
              <View style={[styles.createBox, { backgroundColor: C.surfaceContainerLow }]}>
                <View style={styles.createBoxTop}>
                  <Avatar name={currentDisplayName || '?'} uri={currentPhotoURL} size={36} />
                  <Text style={[styles.createPlaceholder, { color: C.onSurfaceVariant }]}>Share your thoughts...</Text>
                </View>
                <View style={[styles.createBoxBottom, { borderTopColor: C.outlineVariant + '33' }]}>
                  <TouchableOpacity onPress={pickImage} style={styles.createBoxAction}>
                    <Ionicons name="image-outline" size={20} color={C.primary} />
                    <Text style={[styles.createBoxActionText, { color: C.primary }]}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setIsVentMode(true); setShowCreatePost(true); }} style={styles.createBoxAction}>
                    <Ionicons name="flame-outline" size={20} color="#e57373" />
                    <Text style={[styles.createBoxActionText, { color: '#e57373' }]}>Vent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.postPillBtn, { backgroundColor: C.primary }]} onPress={() => setShowCreatePost(true)}>
                    <Text style={[styles.postPillText, { color: C.onPrimary }]}>POST</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>

            {/* TABS (Trending, New, Categories with dropdown) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
              {TABS.map(tab => {
                const tabActive = tab === 'Categories' ? selectedCategory !== 'All' : activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, { backgroundColor: tabActive ? C.primary : C.surfaceContainerHighest, borderColor: tabActive ? C.primary : 'transparent' }]}
                    onPress={() => {
                      if (tab === 'Categories') {
                        setShowCategoryDropdown(true);
                      } else {
                        setActiveTab(tab);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={TAB_ICONS[tab] as any}
                      size={14}
                      color={tabActive ? C.onPrimary : C.onSurfaceVariant}
                    />
                    <Text style={[styles.tabText, { color: tabActive ? C.onPrimary : C.onSurfaceVariant }]}>{tab}</Text>
                    {tab === 'Categories' && selectedCategory !== 'All' && (
                      <View style={[styles.catBadge, { backgroundColor: tabActive ? C.onPrimary + '33' : C.primary + '18' }]}>
                        <Text style={[styles.catBadgeText, { color: tabActive ? C.onPrimary : C.primary }]}>{selectedCategory}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.feedEmptyWrap}>
            {loadingFeed ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <>
                <Ionicons name="chatbubbles-outline" size={34} color={C.onSurfaceVariant} />
                <Text style={[styles.feedEmptyTitle, { color: C.onSurface }]}>No posts yet</Text>
                <Text style={[styles.feedEmptyText, { color: C.onSurfaceVariant }]}>
                  {selectedCategory === 'All'
                    ? 'Start the conversation by sharing a thought.'
                    : `No ${selectedCategory} posts yet.`}
                </Text>
              </>
            )}
          </View>
        }
        ListFooterComponent={
          loadingMoreFeed ? (
            <View style={styles.feedFooter}>
              <ActivityIndicator size="small" color={C.primary} />
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: C.primary }]} onPress={() => setShowCreatePost(true)}>
        <Ionicons name="add" size={28} color={C.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 100 },
  feedEmptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 54, paddingHorizontal: Spacing[8], gap: Spacing[2] },
  feedEmptyTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  feedEmptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, textAlign: 'center', lineHeight: Typography.fontSize.sm * 1.5 },
  feedFooter: { paddingVertical: Spacing[5], alignItems: 'center' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing[5], paddingTop: 60, paddingBottom: Spacing[4] },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  logoMarkImg: { width: 28, height: 28, borderRadius: Radius.full },
  logoMarkText: { fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  logoText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  iconBtn: { width: 36, height: 36, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },

  storiesRow: { paddingHorizontal: Spacing[5], gap: Spacing[3], marginBottom: Spacing[4] },
  storyBubbleWrap: { alignItems: 'center', gap: 6, width: 62, position: 'relative' },
  storyBubble: { width: 56, height: 90, borderRadius: 28, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  storyBubbleImage: { width: '100%', height: '100%' },
  storyVideoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  storyVideoFallback: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  storyBubbleText: { fontFamily: Typography.fontFamily.bold, fontSize: 9, color: '#fff', textAlign: 'center', paddingHorizontal: 4 },
  storyRingUnseen: { borderWidth: 2.5, borderColor: '#2d6a4f' },
  storyRingSeen: { borderWidth: 2, borderColor: '#ccc' },
  storyName: { fontFamily: Typography.fontFamily.medium, fontSize: 11, textAlign: 'center', width: 62 },

  createBox: {
    marginHorizontal: Spacing[5], borderRadius: 20,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[4],
    marginBottom: Spacing[3], gap: Spacing[3], minHeight: 120,
  },
  createBoxTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], flex: 1 },
  createPlaceholder: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, paddingTop: 8 },
  createBoxBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: 1, paddingTop: Spacing[3],
  },
  createBoxAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: Spacing[2] },
  createBoxActionText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  postPillBtn: { borderRadius: Radius.full, paddingHorizontal: Spacing[4], paddingVertical: 8 },
  postPillText: { fontFamily: Typography.fontFamily.bold, fontSize: 12, letterSpacing: 0.5 },
  createInput: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.lg, minHeight: 120, textAlignVertical: 'top' },

  createTools: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingTop: Spacing[4], borderTopWidth: 1 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing[2], paddingHorizontal: Spacing[3], borderRadius: Radius.full },
  toolText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  ventToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, borderWidth: 1.5, borderColor: '#e57373', paddingHorizontal: Spacing[3], paddingVertical: Spacing[2] },
  ventToggleOn: { backgroundColor: '#e57373', borderColor: '#e57373' },
  ventToggleText: { fontFamily: Typography.fontFamily.bold, fontSize: 12, color: '#e57373' },
  ventInfo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    backgroundColor: '#fce4ec', borderRadius: 12, padding: Spacing[3], marginTop: Spacing[3],
  },
  ventInfoText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, color: '#c62828', flex: 1 },

  tabsRow: { paddingHorizontal: Spacing[5], gap: Spacing[2], marginBottom: Spacing[4] },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] + 2,
    borderRadius: Radius.full, borderWidth: 1,
  },
  tabText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  catBadge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 2 },
  catBadgeText: { fontFamily: Typography.fontFamily.medium, fontSize: 10 },

  // Category dropdown
  categoryDropdown: {
    position: 'absolute', top: 200, left: Spacing[5], right: Spacing[5],
    borderRadius: 20, paddingVertical: Spacing[3], paddingHorizontal: Spacing[2],
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16,
  },
  categoryDropdownTitle: {
    fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
  },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderRadius: 12, marginHorizontal: Spacing[2],
  },
  categoryItemText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },

  // Posts
  postCard: { marginHorizontal: Spacing[5], marginBottom: Spacing[4], borderRadius: 20, padding: Spacing[4], gap: Spacing[3] },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  postAuthorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], flex: 1 },
  postMeta: { flex: 1, gap: 2 },
  postNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flexWrap: 'wrap' },
  postAuthor: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  ventBadge: { backgroundColor: '#e57373', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  ventBadgeText: { fontFamily: Typography.fontFamily.bold, fontSize: 9, color: '#fff' },
  postTime: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs },
  moreBtn: { padding: 4 },
  postContent: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.6 },
  postImage: { width: '100%', height: 200, borderRadius: 16 },
  postActions: { flexDirection: 'row', gap: Spacing[3], borderTopWidth: 1, paddingTop: Spacing[3], flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: Spacing[3], paddingBottom: 40, paddingHorizontal: Spacing[5] },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[4] },
  menuText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.lg },

  fab: { position: 'absolute', bottom: 90, right: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
});
