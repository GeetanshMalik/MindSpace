import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { LinearGradient } from 'expo-linear-gradient';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { CALM_ROOM_SOUNDS, CalmSoundItem } from '../../config/calmRoomSounds';

type ExercisePhase = {
  title: string;
  cue: string;
  duration: number;
  icon: string;
};

type Exercise = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  phases: ExercisePhase[];
};

const EXERCISES: Exercise[] = [
  {
    key: 'box',
    title: 'Box Breathing',
    subtitle: 'A 4-count rhythm for nervous-system reset',
    icon: 'square-outline',
    color: '#9fd8cb',
    phases: [
      { title: 'Breathe In', cue: 'Let your belly expand slowly.', duration: 4, icon: 'arrow-down-outline' },
      { title: 'Hold', cue: 'Stay soft. Keep your shoulders loose.', duration: 4, icon: 'pause-outline' },
      { title: 'Breathe Out', cue: 'Release the air with a long quiet exhale.', duration: 4, icon: 'arrow-up-outline' },
      { title: 'Hold', cue: 'Rest in the empty space.', duration: 4, icon: 'pause-outline' },
    ],
  },
  {
    key: 'grounding',
    title: '5-4-3-2-1 Grounding',
    subtitle: 'Use your senses to come back to the room',
    icon: 'hand-left-outline',
    color: '#f1c98d',
    phases: [
      { title: '5 Things You See', cue: 'Look around and name five shapes, colors, or objects.', duration: 18, icon: 'eye-outline' },
      { title: '4 Things You Feel', cue: 'Notice texture, temperature, pressure, or contact.', duration: 16, icon: 'hand-left-outline' },
      { title: '3 Things You Hear', cue: 'Listen close, then far away, then inside the room.', duration: 14, icon: 'volume-medium-outline' },
      { title: '2 Things You Smell', cue: 'Find two scents, even if one is only air.', duration: 12, icon: 'flower-outline' },
      { title: '1 Thing You Taste', cue: 'Notice the taste in your mouth or take a sip of water.', duration: 10, icon: 'water-outline' },
    ],
  },
  {
    key: 'scan',
    title: 'Body Scan',
    subtitle: 'Move attention through the body, one area at a time',
    icon: 'body-outline',
    color: '#b7c8f2',
    phases: [
      { title: 'Forehead and Jaw', cue: 'Unclench your jaw and let your face become heavier.', duration: 18, icon: 'happy-outline' },
      { title: 'Shoulders and Arms', cue: 'Drop the shoulders. Notice both hands.', duration: 18, icon: 'accessibility-outline' },
      { title: 'Chest and Belly', cue: 'Let your breath move without forcing it.', duration: 18, icon: 'heart-outline' },
      { title: 'Hips and Legs', cue: 'Feel the chair, floor, or bed supporting you.', duration: 18, icon: 'walk-outline' },
      { title: 'Whole Body', cue: 'Hold the whole body in one gentle awareness.', duration: 18, icon: 'sparkles-outline' },
    ],
  },
  {
    key: 'release',
    title: 'Thought Release',
    subtitle: 'Name a thought and let it pass through',
    icon: 'paper-plane-outline',
    color: '#d4b5ea',
    phases: [
      { title: 'Name It', cue: 'Say quietly: this is worry, memory, planning, or fear.', duration: 12, icon: 'pricetag-outline' },
      { title: 'Locate It', cue: 'Find where the thought shows up in your body.', duration: 14, icon: 'locate-outline' },
      { title: 'Give It Space', cue: 'Imagine the thought floating a little farther away.', duration: 16, icon: 'expand-outline' },
      { title: 'Return', cue: 'Come back to one breath and one thing you can see.', duration: 12, icon: 'return-down-back-outline' },
    ],
  },
  {
    key: 'muscle',
    title: 'Release and Relax',
    subtitle: 'Tense gently, then relax each muscle group',
    icon: 'fitness-outline',
    color: '#efb1b1',
    phases: [
      { title: 'Hands', cue: 'Make gentle fists, hold, then release completely.', duration: 12, icon: 'hand-right-outline' },
      { title: 'Shoulders', cue: 'Lift shoulders toward ears, hold, then let them fall.', duration: 12, icon: 'arrow-down-circle-outline' },
      { title: 'Legs', cue: 'Press feet down lightly, hold, then soften.', duration: 12, icon: 'footsteps-outline' },
      { title: 'Full Body', cue: 'Notice the difference between effort and release.', duration: 14, icon: 'leaf-outline' },
    ],
  },
];

export const CalmRoomScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const [selectedExerciseKey, setSelectedExerciseKey] = useState(EXERCISES[0].key);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(EXERCISES[0].phases[0].duration);
  const [isRunning, setIsRunning] = useState(false);
  const [playingSoundKey, setPlayingSoundKey] = useState<string | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const orbAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<AudioPlayer | null>(null);

  const selectedExercise = useMemo(
    () => EXERCISES.find((exercise) => exercise.key === selectedExerciseKey) || EXERCISES[0],
    [selectedExerciseKey]
  );
  const currentPhase = selectedExercise.phases[phaseIndex];

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);

    return () => {
      soundRef.current?.pause();
      soundRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: currentPhase.duration * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    if (!isRunning) {
      progressAnim.stopAnimation();
      return;
    }

    Animated.spring(orbAnim, {
      toValue: currentPhase.title.toLowerCase().includes('out') ? 0.82 : 1.2,
      tension: 26,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [currentPhase, isRunning, orbAnim, progressAnim]);

  useEffect(() => {
    if (!playingSoundKey) {
      waveAnim.stopAnimation();
      waveAnim.setValue(0);
      return;
    }

    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(waveAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [playingSoundKey, waveAnim]);

  useEffect(() => {
    if (!isRunning) return;
    const timeout = setTimeout(() => {
      if (timeLeft > 1) {
        setTimeLeft((value) => value - 1);
      } else {
        advancePhase();
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [isRunning, timeLeft, phaseIndex, selectedExerciseKey]);

  const resetExercise = (exercise: Exercise, start = false) => {
    setSelectedExerciseKey(exercise.key);
    setPhaseIndex(0);
    setTimeLeft(exercise.phases[0].duration);
    setIsRunning(start);
    progressAnim.setValue(0);
    orbAnim.setValue(1);
  };

  const advancePhase = () => {
    setPhaseIndex((prev) => {
      const next = prev + 1;
      if (next >= selectedExercise.phases.length) {
        setIsRunning(false);
        setTimeLeft(selectedExercise.phases[0].duration);
        return 0;
      }
      setTimeLeft(selectedExercise.phases[next].duration);
      return next;
    });
  };

  const toggleSound = async (sound: CalmSoundItem) => {
    try {
      if (playingSoundKey === sound.key) {
        soundRef.current?.pause();
        soundRef.current?.remove();
        soundRef.current = null;
        setPlayingSoundKey(null);
        return;
      }

      if (soundRef.current) {
        soundRef.current.pause();
        soundRef.current.remove();
      }

      const nextSound = createAudioPlayer(sound.source, { downloadFirst: true });
      nextSound.loop = true;
      nextSound.volume = 0.55;
      nextSound.play();
      soundRef.current = nextSound;
      setPlayingSoundKey(sound.key);
    } catch {
      Alert.alert('Sound unavailable', 'This ambient sound could not be played on this device.');
      setPlayingSoundKey(null);
    }
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <LinearGradient
        colors={[C.primaryContainer, C.tertiaryContainer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onPrimaryContainer} />
        </TouchableOpacity>
        <View style={styles.heroContent}>
          <Ionicons name="sparkles-outline" size={34} color={C.onPrimaryContainer} />
          <Text style={[styles.heroTitle, { color: C.onPrimaryContainer }]}>The Calm Room</Text>
          <Text style={[styles.heroSub, { color: C.onPrimaryContainer }]}>Interactive exercises, timers, and ambient sound for a steadier moment.</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Guided Exercises</Text>
          <Text style={[styles.sectionSub, { color: C.onSurfaceVariant }]}>Tap an exercise, then follow the changing cues.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exerciseTabs}>
          {EXERCISES.map((exercise) => {
            const selected = exercise.key === selectedExerciseKey;
            return (
              <TouchableOpacity
                key={exercise.key}
                style={[
                  styles.exerciseTab,
                  { backgroundColor: selected ? exercise.color : C.surfaceContainerLow, borderColor: selected ? exercise.color : C.outlineVariant + '66' },
                ]}
                onPress={() => resetExercise(exercise)}
                activeOpacity={0.82}
              >
                <Ionicons name={exercise.icon as any} size={18} color={selected ? '#1e1e1a' : C.onSurfaceVariant} />
                <Text style={[styles.exerciseTabText, { color: selected ? '#1e1e1a' : C.onSurfaceVariant }]} numberOfLines={1}>
                  {exercise.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.playerCard, { backgroundColor: C.surfaceContainerLow }]}>
          <View style={styles.playerTop}>
            <View>
              <Text style={[styles.playerTitle, { color: C.onSurface }]}>{selectedExercise.title}</Text>
              <Text style={[styles.playerSub, { color: C.onSurfaceVariant }]}>{selectedExercise.subtitle}</Text>
            </View>
            <View style={[styles.timerPill, { backgroundColor: selectedExercise.color }]}>
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          </View>

          <View style={styles.exerciseStage}>
            <Animated.View style={[styles.breathOrb, { backgroundColor: selectedExercise.color, transform: [{ scale: orbAnim }] }]}>
              <Ionicons name={currentPhase.icon as any} size={30} color="#1e1e1a" />
            </Animated.View>
            <Text style={[styles.phaseTitle, { color: C.onSurface }]}>{currentPhase.title}</Text>
            <Text style={[styles.phaseCue, { color: C.onSurfaceVariant }]}>{currentPhase.cue}</Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: C.surfaceContainerHighest }]}>
            <Animated.View style={[styles.progressFill, { backgroundColor: selectedExercise.color, width: progressWidth }]} />
          </View>

          <View style={styles.phaseDots}>
            {selectedExercise.phases.map((phase, index) => (
              <View
                key={`${phase.title}-${index}`}
                style={[
                  styles.phaseDot,
                  { backgroundColor: index <= phaseIndex ? selectedExercise.color : C.surfaceContainerHighest },
                ]}
              />
            ))}
          </View>

          <View style={styles.playerActions}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: C.surfaceContainerHighest }]}
              onPress={() => resetExercise(selectedExercise)}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={18} color={C.onSurface} />
              <Text style={[styles.secondaryBtnText, { color: C.onSurface }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: C.primary }]}
              onPress={() => setIsRunning((value) => !value)}
              activeOpacity={0.85}
            >
              <Ionicons name={isRunning ? 'pause' : 'play'} size={18} color={C.onPrimary} />
              <Text style={[styles.primaryBtnText, { color: C.onPrimary }]}>{isRunning ? 'Pause' : 'Start'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: C.surfaceContainerHighest }]}
              onPress={advancePhase}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: C.onSurface }]}>Next</Text>
              <Ionicons name="arrow-forward-outline" size={18} color={C.onSurface} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Ambient Sounds</Text>
          <Text style={[styles.sectionSub, { color: C.onSurfaceVariant }]}>Tap a sound to play it. Tap again to stop.</Text>
        </View>

        {CALM_ROOM_SOUNDS.map((sound) => {
          const isPlaying = playingSoundKey === sound.key;
          return (
            <TouchableOpacity key={sound.key} onPress={() => toggleSound(sound)} activeOpacity={0.86}>
              <View style={[styles.soundCard, { backgroundColor: isPlaying ? sound.color + '55' : C.surfaceContainerLow }]}>
                <View style={styles.soundRow}>
                  <View style={[styles.soundIcon, { backgroundColor: sound.color }]}>
                    <Ionicons name={sound.icon as any} size={22} color="#1e1e1a" />
                  </View>
                  <View style={styles.soundText}>
                    <Text style={[styles.soundName, { color: C.onSurface }]}>{sound.title}</Text>
                    <Text style={[styles.soundSub, { color: C.onSurfaceVariant }]}>{sound.subtitle}</Text>
                  </View>
                  <Ionicons name={isPlaying ? 'stop-circle' : 'play-circle-outline'} size={34} color={isPlaying ? C.primary : C.onSurfaceVariant} />
                </View>

                {isPlaying ? (
                  <View style={styles.waveRow}>
                    {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
                      <Animated.View
                        key={bar}
                        style={[
                          styles.waveBar,
                          {
                            backgroundColor: sound.color,
                            transform: [
                              {
                                scaleY: waveAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.35 + (bar % 3) * 0.1, 1.1 - (bar % 2) * 0.2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingTop: 60, paddingBottom: Spacing[8] },
  backBtn: { marginLeft: Spacing[5], marginBottom: Spacing[4] },
  heroContent: { alignItems: 'center', paddingHorizontal: Spacing[6], gap: Spacing[2] },
  heroTitle: { fontFamily: Typography.fontFamily.extraBold, fontSize: Typography.fontSize['3xl'] },
  heroSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, textAlign: 'center', lineHeight: Typography.fontSize.md * 1.6, opacity: 0.82 },
  content: { padding: Spacing[5], gap: Spacing[3] },
  sectionHeader: { gap: Spacing[1], marginTop: Spacing[3] },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.xl },
  sectionSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  exerciseTabs: { gap: Spacing[2], paddingRight: Spacing[5] },
  exerciseTab: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], flexDirection: 'row', alignItems: 'center', gap: Spacing[2], maxWidth: 210 },
  exerciseTabText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  playerCard: { borderRadius: 24, padding: Spacing[4], gap: Spacing[4] },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing[3] },
  playerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  playerSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, marginTop: 3, maxWidth: 240 },
  timerPill: { borderRadius: Radius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], alignSelf: 'flex-start' },
  timerText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm, color: '#1e1e1a' },
  exerciseStage: { minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: Spacing[3] },
  breathOrb: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  phaseTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize['2xl'] },
  phaseCue: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, textAlign: 'center', lineHeight: Typography.fontSize.md * 1.5, paddingHorizontal: Spacing[3] },
  progressTrack: { height: 10, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  phaseDots: { flexDirection: 'row', alignSelf: 'center', gap: Spacing[2] },
  phaseDot: { width: 8, height: 8, borderRadius: Radius.full },
  playerActions: { flexDirection: 'row', gap: Spacing[2] },
  primaryBtn: { flex: 1, borderRadius: Radius.full, paddingVertical: Spacing[3], alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing[2] },
  primaryBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md },
  secondaryBtn: { flex: 1, borderRadius: Radius.full, paddingVertical: Spacing[3], alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing[2] },
  secondaryBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  soundCard: { borderRadius: 20, padding: Spacing[4], gap: Spacing[4] },
  soundRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  soundIcon: { width: 48, height: 48, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  soundText: { flex: 1, gap: 2 },
  soundName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  soundSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  waveRow: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  waveBar: { width: 10, height: 48, borderRadius: Radius.full },
});
