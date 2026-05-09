import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Text } from '../TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../theme/useColors';
import { Spacing, Typography, Radius } from '../../theme';
import { openDocument } from '../../utils/fileOpener';

interface DocumentMessageBubbleProps {
  url: string;
  fileName?: string;
  isMe: boolean;
}

export const DocumentMessageBubble = ({ url, fileName, isMe }: DocumentMessageBubbleProps) => {
  const C = useColors();
  
  const displayFileName = fileName || 'Document';
  const extension = displayFileName.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={() => openDocument(url, fileName)}
      style={styles.container}
    >
      <View style={[styles.innerBox, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : C.surfaceContainerHighest }]}>
        <View style={[styles.iconContainer, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : C.primaryContainer }]}>
          <Ionicons name="document-text" size={28} color={isMe ? C.onPrimary : C.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text 
            translate={false} 
            style={[styles.fileName, { color: isMe ? C.onPrimary : C.onSurface }]} 
            numberOfLines={2}
          >
            {displayFileName}
          </Text>
          <Text 
            translate={false} 
            style={[styles.fileType, { color: isMe ? 'rgba(255,255,255,0.7)' : C.onSurfaceVariant }]}
          >
            {extension} • Tap to open
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing[1],
    width: 260, // Fixed width like WhatsApp
  },
  innerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[3],
    borderRadius: Radius.lg,
    gap: Spacing[3],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    marginBottom: 2,
  },
  fileType: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
  },
});
