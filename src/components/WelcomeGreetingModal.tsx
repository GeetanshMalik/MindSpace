import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './TranslatedText';
import { Radius, Spacing, Typography } from '../theme';
import { useColors } from '../theme/useColors';

interface WelcomeGreetingModalProps {
  visible: boolean;
  kind: 'new' | 'returning';
  displayName: string;
  onClose: () => void;
}

export const WelcomeGreetingModal: React.FC<WelcomeGreetingModalProps> = ({
  visible,
  kind,
  displayName,
  onClose,
}) => {
  const C = useColors();
  const firstName = displayName.trim().split(/\s+/)[0] || '';
  const safeFirstName = /^mindspace$/i.test(firstName) ? '' : firstName;
  const isNew = kind === 'new';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: C.surface }]}>
          <View style={[styles.iconWrap, { backgroundColor: C.primaryContainer }]}>
            <Ionicons
              name={isNew ? 'sparkles' : 'heart-circle'}
              size={34}
              color={C.primary}
            />
          </View>

          <Text translate={false} style={[styles.title, { color: C.onSurface }]}>
            {isNew
              ? `Welcome to Mindspace${safeFirstName ? `, ${safeFirstName}` : ''}`
              : `Welcome back${safeFirstName ? `, ${safeFirstName}` : ''}`}
          </Text>
          <Text style={[styles.body, { color: C.onSurfaceVariant }]}>
            {isNew
              ? 'Your sanctuary is ready. Take a breath, explore your space, and make it feel like yours.'
              : 'It has been a while. Your journal, communities, and calm tools are right where you left them.'}
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: C.primary }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, { color: C.onPrimary }]}>
              {isNew ? 'Start Exploring' : 'Ease Back In'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={C.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[5],
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.xl,
    padding: Spacing[6],
    alignItems: 'center',
    gap: Spacing[4],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Typography.fontFamily.extraBold,
    fontSize: Typography.fontSize['2xl'],
    textAlign: 'center',
    letterSpacing: 0,
  },
  body: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.55,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  primaryButtonText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
  },
});
