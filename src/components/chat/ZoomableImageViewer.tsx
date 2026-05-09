import React, { useEffect } from 'react';
import { Modal, StatusBar, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface ZoomableImageViewerProps {
  uri: string | null;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8; // Increased from 4 for more zooming freedom
const SNAP_DURATION = 120;
const DOUBLE_TAP_SCALE = 3;

export const ZoomableImageViewer: React.FC<ZoomableImageViewerProps> = ({ uri, onClose }) => {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
  }, [height, savedScale, savedX, savedY, scale, translateX, translateY, uri, width]);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1, { duration: SNAP_DURATION });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: SNAP_DURATION });
    translateY.value = withTiming(0, { duration: SNAP_DURATION });
    savedX.value = 0;
    savedY.value = 0;
  };

  const clampOffset = (value: number, axisSize: number) => {
    'worklet';
    const maxOffset = Math.max(0, (axisSize * (scale.value - 1)) / 2);
    return Math.min(Math.max(value, -maxOffset), maxOffset);
  };

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      translateX.value = withTiming(clampOffset(translateX.value, width), { duration: SNAP_DURATION });
      translateY.value = withTiming(clampOffset(translateY.value, height), { duration: SNAP_DURATION });
      savedX.value = clampOffset(translateX.value, width);
      savedY.value = clampOffset(translateY.value, height);
    });

  const pan = Gesture.Pan()
    .minDistance(0)
    .averageTouches(true)
    .onBegin(() => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = savedX.value + event.translationX;
      translateY.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      translateX.value = withTiming(clampOffset(translateX.value, width), { duration: SNAP_DURATION });
      translateY.value = withTiming(clampOffset(translateY.value, height), { duration: SNAP_DURATION });
      savedX.value = clampOffset(translateX.value, width);
      savedY.value = clampOffset(translateY.value, height);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
        return;
      }
      scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: SNAP_DURATION });
      savedScale.value = DOUBLE_TAP_SCALE;
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal visible={!!uri} transparent={false} animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.innerContainer}>
          <StatusBar hidden />
          {uri && (
            <GestureDetector gesture={Gesture.Simultaneous(doubleTap, pinch, pan)}>
              <Animated.Image
                source={{ uri }}
                resizeMode="contain"
                style={[styles.image, { width, height }, imageStyle]}
              />
            </GestureDetector>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
