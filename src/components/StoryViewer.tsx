import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Modal, Image, Dimensions, Animated, Pressable, ActivityIndicator, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Text } from './TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Typography } from '../theme';
import { Avatar } from './Avatar';
import type { Story } from '../services/firebase/firestore';
import { deleteStory, markStoryViewed, getUserProfileById } from '../services/firebase/firestore';
import { getProfileDisplayName, getProfilePhotoURL } from '../types/profile';
import { useThemeStore } from '../store/themeStore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Shared Constants ─────────────────────────────────────────────
export const STORY_BG_COLORS = [
  '#2d6a4f', '#264653', '#6a4c93', '#c44536', '#1b4332',
  '#3a0ca3', '#480ca8', '#b5838d', '#023047', '#6d597a',
];

const MAX_VIDEO_SEC = 30;
const IMAGE_DUR_MS = 5000;
const LONG_PRESS_MS = 200;

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const optimizeVideoUrl = (url: string): string => {
  // Fresh Cloudinary video transformations can stall on first request while
  // the derived asset is generated. Play the uploaded video directly so a
  // newly shared story starts the first time it is opened.
  return url;
};

// ═══════════════════════════════════════════════════════════════════
//  StoryVideoPlayer
//
//  Wraps expo-video with full playback control:
//  • Reports real-time progress (0→1) synced to currentTime
//  • Detects buffering vs user-pause via stall detection
//  • Auto-stops at MAX_VIDEO_SEC (30s cap)
//  • Accepts pause/resume via `paused` prop
// ═══════════════════════════════════════════════════════════════════

interface VideoPlayerProps {
  uri: string;
  style: any;
  paused: boolean;
  onReady: (durMs: number) => void;
  onProgress: (frac: number) => void;
  onBuffering: (b: boolean) => void;
  onEnd: () => void;
}

const StoryVideoPlayer: React.FC<VideoPlayerProps> = ({
  uri, style, paused, onReady, onProgress, onBuffering, onEnd,
}) => {
  const src = optimizeVideoUrl(uri);
  const readyFired = useRef(false);
  const endFired = useRef(false);
  const lastT = useRef(0);
  const stallN = useRef(0);
  const pausedRef = useRef(paused);
  const lastPlayAttempt = useRef(0);

  // Stable callback refs — avoids stale closures in intervals/listeners
  const cbReady = useRef(onReady);  cbReady.current = onReady;
  const cbProg  = useRef(onProgress); cbProg.current = onProgress;
  const cbBuf   = useRef(onBuffering); cbBuf.current = onBuffering;
  const cbEnd   = useRef(onEnd);    cbEnd.current = onEnd;

  const player = useVideoPlayer(src, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const ensureReadyAndPlaying = useCallback(() => {
    try {
      const duration = Number(player.duration) || 0;
      if (duration <= 0 || endFired.current) return false;

      if (!readyFired.current) {
        readyFired.current = true;
        const eff = Math.min(duration, MAX_VIDEO_SEC) * 1000;
        cbReady.current(eff);
      }

      if (!pausedRef.current) {
        const now = Date.now();
        if (now - lastPlayAttempt.current > 400) {
          lastPlayAttempt.current = now;
          player.play();
        }
        cbBuf.current(false);
      }

      return true;
    } catch {
      return false;
    }
  }, [player]);

  // ── Play / Pause ──
  useEffect(() => {
    try {
      if (paused) player.pause();
      else ensureReadyAndPlaying();
    } catch {}
  }, [paused, ensureReadyAndPlaying]);

  // ── Status + PlayToEnd listeners ──
  useEffect(() => {
    readyFired.current = false;
    endFired.current = false;
    stallN.current = 0;
    lastT.current = 0;
    lastPlayAttempt.current = 0;

    const sub1 = player.addListener('statusChange', (ev: any) => {
      const st = typeof ev === 'string' ? ev : ev?.status;
      if (st === 'readyToPlay') ensureReadyAndPlaying();
      cbBuf.current(st === 'loading' && !readyFired.current);
    });

    const sub2 = player.addListener('playToEnd', () => {
      if (!endFired.current) { endFired.current = true; cbEnd.current(); }
    });

    return () => {
      try { sub1?.remove(); } catch {}
      try { sub2?.remove(); } catch {}
    };
  }, [player, ensureReadyAndPlaying]);

  useEffect(() => {
    const retries = [0, 250, 750, 1500, 2500].map((delay) =>
      setTimeout(() => {
        ensureReadyAndPlaying();
      }, delay)
    );

    return () => retries.forEach((timer) => clearTimeout(timer));
  }, [ensureReadyAndPlaying, src]);

  // ── Progress poll (100ms) + stall detection ──
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        if (!player.duration || player.duration <= 0 || endFired.current) {
          ensureReadyAndPlaying();
          return;
        }
        ensureReadyAndPlaying();
        const cap = Math.min(player.duration, MAX_VIDEO_SEC);
        const frac = Math.min(player.currentTime / cap, 1);
        cbProg.current(frac);

        // Auto-end at 30s cap
        if (player.currentTime >= cap && !endFired.current) {
          endFired.current = true;
          try { player.pause(); } catch {}
          cbEnd.current();
          return;
        }

        // Stall detection: if time hasn't advanced for >500ms while playing
        if (!pausedRef.current) {
          const delta = Math.abs(player.currentTime - lastT.current);
          if (delta < 0.05) {
            stallN.current++;
            if (stallN.current > 5) cbBuf.current(true);
            if (stallN.current > 10) {
              try { player.play(); } catch {}
            }
          } else {
            if (stallN.current > 5) cbBuf.current(false);
            stallN.current = 0;
          }
          lastT.current = player.currentTime;
        }
      } catch {}
    }, 100);
    return () => clearInterval(iv);
  }, [player, ensureReadyAndPlaying]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="contain"
      nativeControls={false}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════
//  PreviewVideo — muted looping preview for story creation screen
// ═══════════════════════════════════════════════════════════════════
export const PreviewVideo: React.FC<{ uri: string; style: any }> = ({ uri, style }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={style} contentFit="cover" />;
};

// ═══════════════════════════════════════════════════════════════════
//  StoryViewer — WhatsApp-style story viewer
//
//  • Segmented progress bar — one per story
//  • Images/Text: 5s fixed timer (Animated.timing)
//  • Videos: progress driven by real playback position (no timer)
//  • Long press (>200ms): pause — video pauses, timer freezes
//  • Release: resume from exact position
//  • Tap left 1/3: previous story
//  • Tap right 2/3: next story / close
//  • Buffering: spinner overlay, progress freezes
//  • Pause: pause icon overlay
//  • Delete story (author only)
//  • Viewer count + list (author only)
//  • Marks story as viewed (non-author)
// ═══════════════════════════════════════════════════════════════════

interface StoryViewerProps {
  storyGroup: { authorId: string; authorName: string; authorPhotoURL?: string | null; stories: Story[] };
  onClose: () => void;
  currentUserId?: string;
  onStoryViewed?: (authorId: string) => void;
}

type ViewerProfile = {
  id: string;
  name: string;
  photoURL?: string;
};

export const StoryViewer: React.FC<StoryViewerProps> = ({ storyGroup, onClose, currentUserId, onStoryViewed }) => {
  const lowStimulation = useThemeStore((state) => state.lowStimulation);
  const total = storyGroup.stories.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // ── Mount delay fix: gate rendering until layout is settled ──
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // ── Viewers bottom sheet ──
  const [showViewers, setShowViewers] = useState(false);
  const [viewerProfiles, setViewerProfiles] = useState<ViewerProfile[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const isOwner = currentUserId === storyGroup.authorId;

  // One Animated.Value per segment
  const progressAnims = useRef<Animated.Value[]>(
    Array.from({ length: total }, () => new Animated.Value(0)),
  ).current;

  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedFrac = useRef(0);
  const durRef = useRef(IMAGE_DUR_MS);

  // Ref to always read latest index inside callbacks
  const idxRef = useRef(0);
  idxRef.current = currentIndex;

  // Long-press detection
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpActive = useRef(false);

  const story = storyGroup.stories[currentIndex];
  const isVideo = story?.type === 'video';

  // ── Mark story as viewed (non-author) ──
  useEffect(() => {
    if (!mounted || !currentUserId || isOwner) return;
    const s = storyGroup.stories[currentIndex];
    if (s?.id) {
      markStoryViewed(s.id, currentUserId).catch(() => {});
    }
  }, [currentIndex, mounted]);

  // ── Notify parent that this story group was viewed ──
  useEffect(() => {
    if (mounted && onStoryViewed) {
      onStoryViewed(storyGroup.authorId);
    }
  }, [mounted]);

  // ── Internal helpers (use idxRef for latest index) ──

  function stopAnim() {
    animRef.current?.stop();
    animRef.current = null;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  // Advance to next story or close viewer
  const nextRef = useRef(() => {});
  nextRef.current = () => {
    stopAnim();
    const i = idxRef.current;
    progressAnims[i]?.setValue(1);
    if (i < total - 1) setCurrentIndex(i + 1);
    else onClose();
  };

  function goNext() { nextRef.current(); }

  function goPrev() {
    stopAnim();
    const i = idxRef.current;
    progressAnims[i]?.setValue(0);
    if (i > 0) setCurrentIndex(i - 1);
  }

  function startTimer(dur: number, from = 0) {
    stopAnim();
    const i = idxRef.current;
    const remaining = dur * (1 - from);
    progressAnims[i]?.setValue(from);
    if (lowStimulation) {
      timeoutRef.current = setTimeout(() => goNext(), remaining);
      return;
    }
    animRef.current = Animated.timing(progressAnims[i], {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
  }

  // ── Reset on index change ──
  useEffect(() => {
    if (!mounted) return;
    setIsBuffering(false);
    setIsPaused(false);
    lpActive.current = false;
    pausedFrac.current = 0;
    durRef.current = IMAGE_DUR_MS;

    // Fill previous segments, reset current + future
    progressAnims.forEach((a, i) => a.setValue(i < currentIndex ? 1 : 0));

    // Image/Text stories: start a fixed timer
    const s = storyGroup.stories[currentIndex];
    if (s?.type !== 'video') startTimer(IMAGE_DUR_MS);

    return () => stopAnim();
  }, [currentIndex, mounted, lowStimulation]);

  // ── Video callbacks ──
  const handleVideoReady = useCallback((ms: number) => {
    durRef.current = ms;
  }, []);

  const handleVideoProgress = useCallback((f: number) => {
    progressAnims[idxRef.current]?.setValue(f);
  }, []);

  const handleVideoBuffering = useCallback((b: boolean) => {
    setIsBuffering(b);
  }, []);

  const handleVideoEnd = useCallback(() => {
    nextRef.current();
  }, []);

  // ── Pause / Resume ──
  function doPause() {
    setIsPaused(true);
    const s = storyGroup.stories[idxRef.current];
    if (s?.type !== 'video') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      progressAnims[idxRef.current]?.stopAnimation((v) => {
        pausedFrac.current = v;
      });
    }
  }

  function doResume() {
    setIsPaused(false);
    const s = storyGroup.stories[idxRef.current];
    if (s?.type !== 'video') {
      startTimer(durRef.current, pausedFrac.current);
    }
  }

  // ── Touch handling: long-press vs tap ──
  function onIn() {
    lpActive.current = false;
    lpTimer.current = setTimeout(() => {
      lpActive.current = true;
      doPause();
    }, LONG_PRESS_MS);
  }

  function onOutLeft() {
    if (lpTimer.current) clearTimeout(lpTimer.current);
    if (lpActive.current) { lpActive.current = false; doResume(); }
    else goPrev();
  }

  function onOutRight() {
    if (lpTimer.current) clearTimeout(lpTimer.current);
    if (lpActive.current) { lpActive.current = false; doResume(); }
    else goNext();
  }

  // ── Delete current story ──
  const handleDeleteStory = () => {
    if (!story?.id) return;
    doPause();
    Alert.alert('Delete Story', 'Are you sure you want to delete this story?', [
      { text: 'Cancel', style: 'cancel', onPress: () => doResume() },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteStory(story.id!);
            // If this was the last (or only) story, close viewer
            if (total <= 1) {
              onClose();
            } else if (currentIndex >= total - 1) {
              // Was the last story, go back
              setCurrentIndex(Math.max(0, currentIndex - 1));
            } else {
              // Force re-render at same index (next story slides in)
              setCurrentIndex(currentIndex);
              doResume();
            }
          } catch {
            Alert.alert('Error', 'Could not delete story.');
            doResume();
          }
        },
      },
    ]);
  };

  // ── Load viewer names ──
  const handleShowViewers = async () => {
    if (!story) return;
    doPause();
    setShowViewers(true);
    setLoadingViewers(true);
    setViewerProfiles([]);
    const viewedBy = story.viewedBy || [];
    try {
      const viewers = await Promise.all(
        viewedBy.map(async (uid) => {
          const profile = await getUserProfileById(uid);
          return {
            id: uid,
            name: getProfileDisplayName(profile, 'Mindspace User'),
            photoURL: getProfilePhotoURL(profile),
          };
        })
      );
      setViewerProfiles(viewers);
    } catch {
      setViewerProfiles([]);
    } finally {
      setLoadingViewers(false);
    }
  };

  const closeViewers = () => {
    setShowViewers(false);
    doResume();
  };

  if (!story) return null;
  const bg = story.backgroundColor || STORY_BG_COLORS[0];
  const viewerCount = story.viewedBy?.length || 0;

  // Don't render content until mount delay passes
  if (!mounted) {
    return (
      <Modal visible animationType={lowStimulation ? 'none' : 'fade'} transparent onRequestClose={onClose}>
        <View style={[vs.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType={lowStimulation ? 'none' : 'fade'} transparent onRequestClose={onClose}>
      <View style={vs.container}>
        <View style={[vs.storyView, { backgroundColor: bg }]}>

          {/* ─ Segmented Progress Bars ─ */}
          <View style={vs.progressRow}>
            {storyGroup.stories.map((_, i) => (
              <View key={i} style={vs.track}>
                <Animated.View
                  style={[
                    vs.fill,
                    {
                      width: progressAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            ))}
          </View>

          {/* ─ Author row ─ */}
          <View style={vs.authorRow}>
            <Avatar name={storyGroup.authorName} uri={storyGroup.authorPhotoURL || undefined} size={32} />
            <Text translate={false} style={vs.authorName}>{storyGroup.authorName}</Text>
            <Text style={vs.timeText}>
              {story.createdAt?.toDate ? timeAgo(story.createdAt.toDate()) : 'now'}
            </Text>
            {isOwner && (
              <TouchableOpacity onPress={handleDeleteStory} style={vs.deleteBtn}>
                <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={vs.closeBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ─ Story content ─ */}
          <View style={vs.contentArea}>
            {story.type === 'text' && (
              <Text translate={false} style={vs.storyText}>{story.textContent}</Text>
            )}
            {story.type === 'image' && story.mediaUri && (
              <Image source={{ uri: story.mediaUri }} style={vs.storyMedia} resizeMode="contain" />
            )}
            {story.type === 'video' && story.mediaUri && (
              <StoryVideoPlayer
                key={`vid-${currentIndex}`}
                uri={story.mediaUri}
                style={vs.storyMedia}
                paused={isPaused}
                onReady={handleVideoReady}
                onProgress={handleVideoProgress}
                onBuffering={handleVideoBuffering}
                onEnd={handleVideoEnd}
              />
            )}
            {story.caption ? (
              <View style={vs.captionBar}>
                <Text style={vs.captionText}>{story.caption}</Text>
              </View>
            ) : null}
          </View>

          {/* ─ Viewers bar (author only) ─ */}
          {isOwner && (
            <TouchableOpacity style={vs.viewersBar} onPress={handleShowViewers} activeOpacity={0.7}>
              <Ionicons name="eye-outline" size={20} color="rgba(255,255,255,0.85)" />
              <Text style={vs.viewersText}>{viewerCount}</Text>
            </TouchableOpacity>
          )}

          {/* ─ Buffering / Paused overlay ─ */}
          {(isBuffering || isPaused) && !showViewers && (
            <View style={vs.overlay}>
              {isBuffering ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Ionicons name="pause" size={48} color="rgba(255,255,255,0.55)" />
              )}
            </View>
          )}

          {/* ─ Touch zones ─ */}
          {!showViewers && (
            <View style={vs.touchZones}>
              <Pressable style={vs.touchL} onPressIn={onIn} onPressOut={onOutLeft} />
              <Pressable style={vs.touchR} onPressIn={onIn} onPressOut={onOutRight} />
            </View>
          )}
        </View>
      </View>

      {/* ─ Viewers Bottom Sheet ─ */}
      <Modal visible={showViewers} transparent animationType={lowStimulation ? 'none' : 'slide'} onRequestClose={closeViewers}>
        <TouchableOpacity style={vs.viewersOverlay} activeOpacity={1} onPress={closeViewers}>
          <View style={vs.viewersSheet}>
            <View style={vs.viewersHandle} />
            <Text style={vs.viewersTitle}>
              <Ionicons name="eye" size={18} color="#2d6a4f" /> {viewerCount} {viewerCount === 1 ? 'viewer' : 'viewers'}
            </Text>
            {loadingViewers ? (
              <ActivityIndicator size="small" color="#2d6a4f" style={{ marginTop: 20 }} />
            ) : viewerProfiles.length === 0 ? (
              <Text style={vs.noViewers}>No one has viewed this story yet.</Text>
            ) : (
              <FlatList
                data={viewerProfiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={vs.viewerRow}>
                    <Avatar name={item.name} uri={item.photoURL} size={36} />
                    <Text translate={false} style={vs.viewerName}>{item.name}</Text>
                  </View>
                )}
                style={{ maxHeight: 300 }}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════════
const vs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  storyView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressRow: {
    position: 'absolute', top: 50, left: 16, right: 16,
    flexDirection: 'row', gap: 4, zIndex: 10,
  },
  track: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2, overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  authorRow: {
    position: 'absolute', top: 64, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10,
  },
  authorName: {
    fontFamily: Typography.fontFamily.semiBold, fontSize: 14,
    color: '#fff', flex: 1,
  },
  timeText: {
    fontFamily: Typography.fontFamily.regular, fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  deleteBtn: { padding: 4 },
  closeBtn: { padding: 4 },
  contentArea: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    width: '100%', paddingHorizontal: 24, paddingTop: 100,
  },
  storyText: {
    fontFamily: Typography.fontFamily.bold, fontSize: 28, color: '#fff',
    textAlign: 'center', lineHeight: 40,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  storyMedia: { width: SCREEN_W - 32, height: SCREEN_H * 0.65, borderRadius: 12 },
  captionBar: {
    position: 'absolute', bottom: 60, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 16, paddingHorizontal: 24,
  },
  captionText: {
    fontFamily: Typography.fontFamily.regular, fontSize: 16,
    color: '#fff', textAlign: 'center',
  },
  viewersBar: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, zIndex: 10, paddingVertical: 8,
  },
  viewersText: {
    fontFamily: Typography.fontFamily.semiBold, fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', zIndex: 6,
  },
  touchZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 5 },
  touchL: { flex: 1 },
  touchR: { flex: 2 },
  // Viewers bottom sheet
  viewersOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  viewersSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, minHeight: 200,
  },
  viewersHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc',
    alignSelf: 'center', marginBottom: 16,
  },
  viewersTitle: {
    fontFamily: Typography.fontFamily.bold, fontSize: 16,
    color: '#1a1a1a', marginBottom: 16,
  },
  noViewers: {
    fontFamily: Typography.fontFamily.regular, fontSize: 14,
    color: '#999', textAlign: 'center', marginTop: 20,
  },
  viewerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  viewerName: {
    fontFamily: Typography.fontFamily.medium, fontSize: 15,
    color: '#1a1a1a',
  },
});
