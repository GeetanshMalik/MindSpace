import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, StatusBar, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';

interface VideoMessageBubbleProps {
  uri: string;
  width?: number;
  height?: number;
}

/**
 * Shows a thumbnail with a play icon in the chat bubble.
 * On tap, opens a fullscreen modal with video playback + native controls.
 */
export const VideoMessageBubble: React.FC<VideoMessageBubbleProps> = ({
  uri,
  width = 220,
  height = 160,
}) => {
  const [showFullscreen, setShowFullscreen] = useState(false);

  const openFullscreen = useCallback(() => setShowFullscreen(true), []);
  const closeFullscreen = useCallback(() => setShowFullscreen(false), []);

  return (
    <>
      {/* Thumbnail in the chat bubble */}
      <TouchableOpacity onPress={openFullscreen} activeOpacity={0.85}>
        <View style={[styles.thumbnail, { width, height }]}>
          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
        </View>
      </TouchableOpacity>

      {/* Fullscreen video modal */}
      <Modal
        visible={showFullscreen}
        animationType="fade"
        transparent={false}
        onRequestClose={closeFullscreen}
        supportedOrientations={['portrait', 'landscape']}
      >
        <View style={styles.fullscreenContainer}>
          <StatusBar hidden />
          <FullscreenPlayer uri={uri} />
          <TouchableOpacity style={styles.closeBtn} onPress={closeFullscreen}>
            <View style={styles.closeBtnBg}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
};

/**
 * Separate component so the useVideoPlayer hook is only created
 * when the fullscreen modal is mounted.
 */
const FullscreenPlayer: React.FC<{ uri: string }> = ({ uri }) => {
  const { width, height } = useWindowDimensions();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={[styles.fullscreenVideo, { width, height }]}
      nativeControls={true}
      contentFit="contain"
      allowsPictureInPicture
    />
  );
};

const styles = StyleSheet.create({
  thumbnail: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideo: {
    backgroundColor: '#000',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeBtnBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
