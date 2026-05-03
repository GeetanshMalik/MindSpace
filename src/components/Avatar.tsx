import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Text } from './TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Typography } from '../theme';
import { useColors } from '../theme/useColors';

interface AvatarProps {
  name?: string;
  uri?: string;
  size?: number;
  previewable?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ name, uri, size = 40, previewable = true }) => {
  const C = useColors();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const imageUri = uri && failedUri !== uri ? uri : undefined;

  useEffect(() => {
    setFailedUri(null);
  }, [uri]);

  if (imageUri) {
    const image = (
      <Image
        source={{ uri: imageUri }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceContainerHighest }]}
        onError={() => setFailedUri(imageUri)}
      />
    );

    if (!previewable) return image;

    return (
      <>
        <TouchableOpacity activeOpacity={0.82} onPress={() => setPreviewVisible(true)}>
          {image}
        </TouchableOpacity>
        <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <View style={styles.viewer}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPreviewVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: imageUri }} style={styles.viewerImage} resizeMode="contain" />
          </View>
        </Modal>
      </>
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: C.primaryContainer },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.35, color: C.onPrimaryContainer }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {},
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '78%',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: Typography.fontFamily.semiBold,
  },
});
