import React from 'react';
import { Linking, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './TranslatedText';
import { Radius, Spacing, Typography } from '../theme';
import { useColors } from '../theme/useColors';
import { useTranslation } from '../i18n/useTranslation';

type CrisisSupportModalProps = {
  visible: boolean;
  onClose: () => void;
};

type CrisisResource = {
  id: string;
  name: string;
  detail: string;
  phone: string;
  availability: string;
  tone: 'urgent' | 'support';
};

const RESOURCES: CrisisResource[] = [
  {
    id: '112',
    name: 'Emergency Services',
    detail: 'Police, ambulance, fire, and immediate danger support across India.',
    phone: '112',
    availability: '24/7 emergency response',
    tone: 'urgent',
  },
  {
    id: 'tele-manas',
    name: 'Tele-MANAS',
    detail: 'Government mental health support and counselling helpline.',
    phone: '14416',
    availability: '24/7 mental health support',
    tone: 'support',
  },
  {
    id: 'kiran',
    name: 'KIRAN Mental Health Helpline',
    detail: 'Mental health rehabilitation support in Indian languages.',
    phone: '1800-599-0019',
    availability: '24/7 toll-free support',
    tone: 'support',
  },
  {
    id: 'vandrevala',
    name: 'Vandrevala Foundation',
    detail: 'Free crisis intervention and mental health counselling.',
    phone: '+91 9999 666 555',
    availability: '24/7 phone and WhatsApp support',
    tone: 'support',
  },
  {
    id: 'icall',
    name: 'iCALL Psychosocial Helpline',
    detail: 'TISS counselling support for emotional and psychological distress.',
    phone: '9152987821',
    availability: 'Mon-Sat counselling support',
    tone: 'support',
  },
];

const toTelUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export const CrisisSupportModal: React.FC<CrisisSupportModalProps> = ({ visible, onClose }) => {
  const C = useColors();
  const { t } = useTranslation();

  const callResource = (phone: string) => {
    Linking.openURL(toTelUrl(phone)).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.surface }]}>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: `${C.error}18` }]}>
              <Ionicons name="call" size={22} color={C.error} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: C.onSurface }]}>Immediate Support</Text>
              <Text style={[styles.subtitle, { color: C.onSurfaceVariant }]}>
                If someone is in immediate danger, call emergency services now.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.emergencyButton, { backgroundColor: C.error }]}
            onPress={() => callResource('112')}
            activeOpacity={0.86}
          >
            <Ionicons name="call" size={20} color={C.onError} />
            <Text style={[styles.emergencyButtonText, { color: C.onError }]}>Call 112 Emergency</Text>
          </TouchableOpacity>

          <ScrollView
            style={styles.resourceScroll}
            contentContainerStyle={styles.resourceList}
            showsVerticalScrollIndicator={false}
          >
            {RESOURCES.map((resource) => {
              const isUrgent = resource.tone === 'urgent';
              const accent = isUrgent ? C.error : C.primary;

              return (
                <View
                  key={resource.id}
                  style={[
                    styles.resourceRow,
                    { backgroundColor: C.surfaceContainerLow, borderColor: `${accent}22` },
                  ]}
                >
                  <View style={[styles.resourceIcon, { backgroundColor: `${accent}18` }]}>
                    <Ionicons name={isUrgent ? 'alert-circle' : 'heart-circle'} size={22} color={accent} />
                  </View>
                  <View style={styles.resourceBody}>
                    <Text style={[styles.resourceName, { color: C.onSurface }]}>
                      {resource.name}
                    </Text>
                    <Text style={[styles.resourceDetail, { color: C.onSurfaceVariant }]}>
                      {resource.detail}
                    </Text>
                    <Text translate={false} style={[styles.resourceMeta, { color: accent }]}>
                      {resource.phone} - {t(resource.availability)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.callButton, { backgroundColor: `${accent}16` }]}
                    onPress={() => callResource(resource.phone)}
                    activeOpacity={0.78}
                  >
                    <Ionicons name="call-outline" size={18} color={accent} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          <Text style={[styles.footerNote, { color: C.onSurfaceVariant }]}>
            Mindspace is not emergency care. These numbers connect you to trained support outside the app.
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    padding: Spacing[5],
  },
  sheet: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: Radius.xl,
    padding: Spacing[5],
    gap: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: Typography.fontFamily.extraBold,
    fontSize: Typography.fontSize['2xl'],
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.45,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyButton: {
    minHeight: 50,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  emergencyButtonText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
  },
  resourceScroll: {
    flexGrow: 0,
  },
  resourceList: {
    gap: Spacing[3],
  },
  resourceRow: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  resourceIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceBody: {
    flex: 1,
    gap: 3,
  },
  resourceName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
  },
  resourceDetail: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.35,
  },
  resourceMeta: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
  },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNote: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    lineHeight: Typography.fontSize.xs * 1.45,
    textAlign: 'center',
  },
});
