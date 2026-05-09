import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Share as RNShare,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Text } from '../../components/TranslatedText';
import { ProfileAvatar, ProfileName } from '../../components/ProfileAvatar';
import { Radius, Spacing, Typography } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';
import {
  addPostComment,
  createNotification,
  deletePostComment,
  getPostById,
  Post,
  PostComment,
  subscribeToPostComments,
  subscribeToPostUpdates,
  toggleLike,
  toggleSolidarity,
} from '../../services/firebase/firestore';
import { applyPostReaction, getReactionCount, hasUserReaction, ReactionField } from '../../utils/postReactions';
import { getPostShareUrl } from '../../utils/shareLinks';

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

type ImageSize = {
  width: number;
  height: number;
};

export const PostDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = useColors();
  const { user, profile } = useAuthStore();
  const postId = route.params?.postId as string | undefined;
  const highlightCommentId = route.params?.highlightCommentId as string | undefined;
  const currentDisplayName = getProfileDisplayName(profile, user?.displayName || 'Anonymous');
  const currentPhotoURL = getProfilePhotoURL(profile, user?.photoURL);

  const [post, setPost] = useState<Post | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [imageWidth, setImageWidth] = useState(0);
  const [pendingReactions, setPendingReactions] = useState<Record<string, boolean>>({});
  const pendingReactionsRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    pendingReactionsRef.current = pendingReactions;
  }, [pendingReactions]);

  useEffect(() => {
    if (!postId) {
      setLoadingPost(false);
      return;
    }

    let cancelled = false;
    setLoadingPost(true);
    getPostById(postId)
      .then((nextPost) => {
        if (cancelled) return;
        if (!nextPost) {
          Alert.alert('Post unavailable', 'This post could not be found.');
          navigation.goBack();
          return;
        }
        setPost(nextPost);
      })
      .catch(() => {
        if (!cancelled) Alert.alert('Post unavailable', 'Could not load this post right now.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPost(false);
      });

    return () => { cancelled = true; };
  }, [navigation, postId]);

  useEffect(() => {
    if (!postId) return;
    return subscribeToPostUpdates(
      [postId],
      (updatedPosts, removedPostIds) => {
        if (removedPostIds.includes(postId)) {
          Alert.alert('Post deleted', 'This post is no longer available.');
          navigation.goBack();
          return;
        }

        const updated = updatedPosts.find((item) => item.id === postId);
        if (!updated) return;

        setPost((current) => {
          const pending = pendingReactionsRef.current;
          const keepLikes = !!pending[`${postId}:likes`];
          const keepSolidarity = !!pending[`${postId}:solidarity`];
          if (!current || (!keepLikes && !keepSolidarity)) return updated;

          return {
            ...updated,
            ...(keepLikes ? {
              likes: current.likes,
              likesCount: current.likesCount,
            } : {}),
            ...(keepSolidarity ? {
              solidarity: current.solidarity,
              solidarityCount: current.solidarityCount,
            } : {}),
            engagementScore: current.engagementScore,
          };
        });
      },
      () => {}
    );
  }, [navigation, postId]);

  useEffect(() => {
    if (!postId) return;
    return subscribeToPostComments(postId, setComments);
  }, [postId]);

  useEffect(() => {
    if (!post?.imageUrl) {
      setImageSize(null);
      return;
    }

    Image.getSize(
      post.imageUrl,
      (naturalWidth, naturalHeight) => setImageSize({ width: naturalWidth, height: naturalHeight }),
      () => setImageSize(null)
    );
  }, [post?.imageUrl]);

  const setReactionPending = (field: ReactionField, pending: boolean) => {
    if (!postId) return;
    const key = `${postId}:${field}`;
    setPendingReactions((current) => {
      if (pending) return { ...current, [key]: true };
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const isReactionPending = (field: ReactionField) =>
    !!postId && !!pendingReactions[`${postId}:${field}`];

  const updateReaction = (field: ReactionField, active: boolean) => {
    if (!user) return;
    setPost((current) => current ? applyPostReaction(current, user.uid, field, active) : current);
  };

  const handleReaction = async (field: ReactionField) => {
    if (!post || !post.id || !user) {
      Alert.alert('Sign in required');
      return;
    }
    if (isReactionPending(field)) return;

    const wasActive = hasUserReaction(post, field, user.uid);
    const nextActive = !wasActive;
    setReactionPending(field, true);
    updateReaction(field, nextActive);

    try {
      if (field === 'likes') {
        await toggleLike(post.id, user.uid, wasActive);
      } else {
        await toggleSolidarity(post.id, user.uid, wasActive);
      }

      if (!wasActive && post.authorId !== user.uid) {
        createNotification(post.authorId, {
          type: field === 'likes' ? 'like' : 'solidarity',
          text: field === 'likes'
            ? `${currentDisplayName} liked your post`
            : `${currentDisplayName} sent solidarity on your post`,
          fromUserId: user.uid,
          fromUserName: currentDisplayName,
          postId: post.id,
        }).catch(() => {});
      }
    } catch {
      updateReaction(field, wasActive);
      Alert.alert('Error', field === 'likes'
        ? 'Could not update like. Please try again.'
        : 'Could not update solidarity. Please try again.');
    } finally {
      setReactionPending(field, false);
    }
  };

  const handleSendComment = async () => {
    const msg = commentText.trim();
    if (!post || !post.id || !user || !msg || sendingComment) return;

    setSendingComment(true);
    setCommentText('');
    try {
      const commentId = await addPostComment(post.id, {
        authorId: user.uid,
        authorName: currentDisplayName,
        authorPhotoURL: currentPhotoURL || null,
        text: msg,
      });
      if (post.authorId !== user.uid) {
        createNotification(post.authorId, {
          type: 'comment',
          text: `${currentDisplayName} commented: "${msg.substring(0, 50)}"`,
          fromUserId: user.uid,
          fromUserName: currentDisplayName,
          postId: post.id,
          commentId,
        }).catch(() => {});
      }
    } catch {
      setCommentText(msg);
      Alert.alert('Error', 'Could not post comment. Please try again.');
    } finally {
      setSendingComment(false);
    }
  };

  const handleShare = async () => {
    if (!post?.id) return;
    const caption = post.content?.trim();
    const postUrl = getPostShareUrl(post.id);

    try {
      await RNShare.share({
        message: caption
          ? `"${caption}"\n\n${postUrl}\n\n- ${post.authorName} on Mindspace`
          : `${post.authorName} shared a photo on Mindspace\n\n${postUrl}`,
        url: postUrl,
      });
    } catch {
      // Share was cancelled.
    }
  };

  const canDeleteComment = (comment: PostComment) =>
    !!user && !!comment.id && !!post && (comment.authorId === user.uid || post.authorId === user.uid);

  const handleDeleteComment = (comment: PostComment) => {
    if (!post?.id || !comment.id || !canDeleteComment(comment)) return;

    Alert.alert('Delete Comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePostComment(post.id!, comment.id!);
          } catch {
            Alert.alert('Error', 'Could not delete comment.');
          }
        },
      },
    ]);
  };

  const openProfile = () => {
    if (!post || post.isVentMode) return;
    if (user && post.authorId === user.uid) {
      navigation.navigate('MainTabs', { screen: 'ProfileTab' });
    } else {
      navigation.navigate('MainTabs', {
        screen: 'CommunityTab',
        params: {
          screen: 'ViewProfile',
          params: { userId: post.authorId, userName: post.authorName },
        },
      });
    }
  };

  const openAuthorFromComment = (comment: PostComment) => {
    if (!comment.authorId) return;
    if (user && comment.authorId === user.uid) {
      navigation.navigate('MainTabs', { screen: 'ProfileTab' });
    } else {
      navigation.navigate('MainTabs', {
        screen: 'CommunityTab',
        params: {
          screen: 'ViewProfile',
          params: { userId: comment.authorId, userName: comment.authorName },
        },
      });
    }
  };

  const renderedImageHeight = imageSize && imageWidth
    ? Math.max(180, imageWidth * (imageSize.height / imageSize.width))
    : 260;
  const liked = post ? hasUserReaction(post, 'likes', user?.uid) : false;
  const solidarityActive = post ? hasUserReaction(post, 'solidarity', user?.uid) : false;
  const likesCount = post ? getReactionCount(post, 'likes') : 0;
  const solidarityCount = post ? getReactionCount(post, 'solidarity') : 0;
  const commentsCount = comments.length;
  const likePending = isReactionPending('likes');
  const solidarityPending = isReactionPending('solidarity');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style={C.surface === '#141412' ? 'light' : 'dark'} />
      <View style={[styles.header, { borderBottomColor: `${C.outlineVariant}33` }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: C.surfaceContainerHigh }]} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.onSurface }]}>Post</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loadingPost ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={C.primary} />
        </View>
      ) : !post ? (
        <View style={styles.loadingWrap}>
          <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>Post unavailable</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.authorRow} onPress={openProfile} activeOpacity={post.isVentMode ? 1 : 0.75}>
            <ProfileAvatar
              userId={!post.isVentMode ? post.authorId : undefined}
              name={post.isVentMode ? '?' : post.authorName}
              uri={!post.isVentMode ? post.authorPhotoURL || undefined : undefined}
              size={44}
            />
            <View style={styles.authorMeta}>
              {post.isVentMode ? (
                <Text translate={false} style={[styles.authorName, { color: C.onSurface }]}>Anonymous</Text>
              ) : (
                <ProfileName userId={post.authorId} fallbackName={post.authorName} style={[styles.authorName, { color: C.onSurface }]} />
              )}
              <Text style={[styles.postMeta, { color: C.onSurfaceVariant }]}>
                {post.createdAt?.toDate ? timeAgo(post.createdAt.toDate()) : 'just now'} - {post.category || 'General'}
              </Text>
            </View>
          </TouchableOpacity>

          {post.content?.trim() ? (
            <Text translate={false} style={[styles.caption, { color: C.onSurface }]}>
              {post.content.trim()}
            </Text>
          ) : null}

          {post.imageUrl ? (
            <View
              style={styles.imageWrap}
              onLayout={(event) => setImageWidth(event.nativeEvent.layout.width)}
            >
              <Image
                source={{ uri: post.imageUrl }}
                style={[styles.postImage, { height: renderedImageHeight, backgroundColor: C.surfaceContainerLow }]}
                resizeMode="contain"
              />
            </View>
          ) : null}

          <View style={[styles.actions, { borderTopColor: `${C.outlineVariant}44`, borderBottomColor: `${C.outlineVariant}44` }]}>
            <TouchableOpacity
              style={[styles.actionBtn, likePending && styles.pendingAction]}
              onPress={() => handleReaction('likes')}
              disabled={likePending}
              activeOpacity={0.65}
            >
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? C.primary : C.onSurfaceVariant} />
              <Text style={[styles.actionText, { color: liked ? C.primary : C.onSurfaceVariant }]}>
                {likesCount > 0 ? `${likesCount} ` : ''}Like
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, solidarityPending && styles.pendingAction]}
              onPress={() => handleReaction('solidarity')}
              disabled={solidarityPending}
              activeOpacity={0.65}
            >
              <Ionicons name={solidarityActive ? 'hand-left' : 'hand-left-outline'} size={20} color={solidarityActive ? C.primary : C.onSurfaceVariant} />
              <Text style={[styles.actionText, { color: solidarityActive ? C.primary : C.onSurfaceVariant }]}>
                {solidarityCount > 0 ? `${solidarityCount} ` : ''}Solidarity
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.shareAction]}
              onPress={handleShare}
              activeOpacity={0.65}
            >
              <Ionicons name="share-social-outline" size={19} color={C.onSurfaceVariant} />
              <Text style={[styles.actionText, { color: C.onSurfaceVariant }]}>Share</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.commentsHeader}>
            <Text style={[styles.commentsTitle, { color: C.onSurface }]}>Comments</Text>
            <Text style={[styles.commentsCount, { color: C.onSurfaceVariant }]}>{commentsCount}</Text>
          </View>

          {comments.length > 0 ? comments.map((comment) => (
            <View key={comment.id || `${comment.authorId}-${comment.text}`} style={styles.commentRow}>
              <TouchableOpacity activeOpacity={0.75} onPress={() => openAuthorFromComment(comment)}>
                <ProfileAvatar userId={comment.authorId} name={comment.authorName} uri={comment.authorPhotoURL} size={34} />
              </TouchableOpacity>
              <View
                style={[
                  styles.commentBubble,
                  { backgroundColor: comment.id === highlightCommentId ? C.primaryContainer : C.surfaceContainerLow },
                ]}
              >
                <View style={styles.commentTopRow}>
                  <ProfileName userId={comment.authorId} fallbackName={comment.authorName} style={[styles.commentAuthor, { color: C.primary }]} />
                  {canDeleteComment(comment) ? (
                    <TouchableOpacity onPress={() => handleDeleteComment(comment)} hitSlop={8} activeOpacity={0.65}>
                      <Ionicons name="trash-outline" size={15} color={C.error} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text translate={false} style={[styles.commentText, { color: C.onSurface }]}>{comment.text}</Text>
                <Text style={[styles.commentTime, { color: C.onSurfaceVariant }]}>
                  {comment.createdAt?.toDate ? timeAgo(comment.createdAt.toDate()) : 'just now'}
                </Text>
              </View>
            </View>
          )) : (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color={C.outlineVariant} />
              <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>No comments yet</Text>
            </View>
          )}

          <View style={[styles.inputRow, { backgroundColor: C.surfaceContainerLow }]}>
            <TextInput
              style={[styles.input, { backgroundColor: C.surfaceContainerHighest, color: C.onSurface }]}
              placeholder="Write a comment..."
              placeholderTextColor={C.onSurfaceVariant}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: C.primary }, (!commentText.trim() || sendingComment) && styles.disabledSend]}
              onPress={handleSendComment}
              disabled={!commentText.trim() || sendingComment}
            >
              <Ionicons name="send" size={18} color={C.onPrimary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  headerSpacer: { width: 42 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing[3] },
  scroll: { flex: 1 },
  content: { padding: Spacing[5], gap: Spacing[4], paddingBottom: 80 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  authorMeta: { flex: 1, gap: 2 },
  authorName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  postMeta: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs },
  caption: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.6,
  },
  imageWrap: { width: '100%' },
  postImage: { width: '100%', borderRadius: 16 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: Spacing[3],
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  shareAction: { marginLeft: 'auto' },
  pendingAction: { opacity: 0.65 },
  actionText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: Spacing[2] },
  commentsTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  commentsCount: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3] },
  commentBubble: { flex: 1, borderRadius: 16, padding: Spacing[3], gap: 3 },
  commentTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing[2] },
  commentAuthor: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  commentText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.45,
  },
  commentTime: { fontFamily: Typography.fontFamily.regular, fontSize: 11 },
  emptyComments: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: Spacing[2] },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[3],
    borderRadius: 18,
    padding: Spacing[3],
  },
  input: {
    flex: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    maxHeight: 110,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSend: { opacity: 0.45 },
});
