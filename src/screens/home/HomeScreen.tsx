import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, Linking, Animated, Image } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Colors, Spacing, Typography, Radius, Shadow } from '../../theme';
import { useColors } from '../../theme/useColors';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { Card } from '../../components/Card';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getFeedCacheKey, usePostStore } from '../../store/postStore';
import { HomeStackParamList } from '../../navigation/MainTabNavigator';
import { Community, Reflection, fetchFeedPage, subscribeToCommunities, subscribeToUserReflections } from '../../services/firebase/firestore';
import { buildMoodWeek, formatMoodWeekRange, getDateKey, getMoodByScore, getReflectionMoodScore, MOOD_OPTIONS, toDate } from '../../utils/mood';
import { useTranslation } from '../../i18n/useTranslation';

const APP_LOGO = require('../../../assets/logo.png');

type NavProp = StackNavigationProp<HomeStackParamList, 'Home'>;
const { width } = Dimensions.get('window');

// ─── 50 Curated Mental Wellness Quotes ────────────────────────────────
const QUOTES: { text: string; author: string }[] = [
  { text: "The most beautiful people we have known are those who have known defeat, known suffering, known struggle, known loss, and have found their way out of the depths.", author: "Elisabeth Kubler-Ross" },
  { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
  { text: "There is hope, even when your brain tells you there isn't.", author: "John Green" },
  { text: "You are not your illness. You have an individual story to tell. You have a name, a history, a personality. Staying yourself is part of the battle.", author: "Julian Seifter" },
  { text: "Mental health is not a destination, but a process. It's about how you drive, not where you're going.", author: "Noam Shpancer" },
  { text: "Self-care is how you take your power back.", author: "Lalah Delia" },
  { text: "Healing takes time, and asking for help is a courageous step.", author: "Mariska Hargitay" },
  { text: "You, yourself, as much as anybody in the entire universe, deserve your love and affection.", author: "Buddha" },
  { text: "Not until we are lost do we begin to understand ourselves.", author: "Henry David Thoreau" },
  { text: "What mental health needs is more sunlight, more candor, and more unashamed conversation.", author: "Glenn Close" },
  { text: "The only journey is the one within.", author: "Rainer Maria Rilke" },
  { text: "Be gentle with yourself. You are a child of the universe no less than the trees and the stars.", author: "Max Ehrmann" },
  { text: "Your present circumstances don't determine where you can go; they merely determine where you start.", author: "Nido Qubein" },
  { text: "Promise me you'll always remember: you're braver than you believe, and stronger than you seem, and smarter than you think.", author: "A.A. Milne" },
  { text: "Sometimes the people around you won't understand your journey. They don't need to, it's not for them.", author: "Joubert Botha" },
  { text: "Happiness can be found even in the darkest of times, if one only remembers to turn on the light.", author: "Albus Dumbledore" },
  { text: "It's not the load that breaks you down, it's the way you carry it.", author: "Lou Holtz" },
  { text: "You don't have to be positive all the time. It's perfectly okay to feel sad, angry, annoyed, frustrated, scared, or anxious.", author: "Lori Deschene" },
  { text: "Nothing can dim the light that shines from within.", author: "Maya Angelou" },
  { text: "Owning our story and loving ourselves through that process is the bravest thing that we'll ever do.", author: "Brene Brown" },
  { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Vulnerability is not winning or losing; it's having the courage to show up and be seen.", author: "Brene Brown" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { text: "Tough times never last but tough people do.", author: "Robert H. Schuller" },
  { text: "You are allowed to be both a masterpiece and a work in progress simultaneously.", author: "Sophia Bush" },
  { text: "Recovery is not one and done. It is a lifelong journey that takes place one day, one step at a time.", author: "Unknown" },
  { text: "The wound is the place where the Light enters you.", author: "Rumi" },
  { text: "Out of suffering have emerged the strongest souls; the most massive characters are seared with scars.", author: "Kahlil Gibran" },
  { text: "In the middle of winter, I at last discovered that there was in me an invincible summer.", author: "Albert Camus" },
  { text: "Courage doesn't always roar. Sometimes courage is the quiet voice at the end of the day saying, I will try again tomorrow.", author: "Mary Anne Radmacher" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "We cannot selectively numb emotions. When we numb the painful emotions, we also numb the positive emotions.", author: "Brene Brown" },
  { text: "The only way out is through.", author: "Robert Frost" },
  { text: "Your illness does not define you. Your strength and courage does.", author: "Unknown" },
  { text: "Be patient with yourself. Self-growth is tender; it's holy ground. There's no greater investment.", author: "Stephen Covey" },
  { text: "You wake up every morning to fight the same demons that left you so tired the night before, and that, my love, is bravery.", author: "Unknown" },
  { text: "One small crack does not mean that you are broken, it means that you were put to the test and you didn't fall apart.", author: "Linda Poindexter" },
  { text: "Just because no one else can heal or do your inner work for you doesn't mean you can, should, or need to do it alone.", author: "Lisa Olivera" },
  { text: "If you're going through hell, keep going.", author: "Winston Churchill" },
  { text: "The bravest thing I ever did was continuing my life when I wanted to die.", author: "Juliette Lewis" },
  { text: "Deep breathing is our nervous system's love language.", author: "Dr. Lauren Fogel Mersy" },
  { text: "The sun himself is weak when he first rises, and gathers strength and courage as the day gets on.", author: "Charles Dickens" },
  { text: "Sometimes you climb out of bed in the morning and you think, I'm not going to make it, but you laugh inside, remembering all the times you've felt that way.", author: "Charles Bukowski" },
  { text: "Feelings are something you have; not something you are.", author: "Shannon L. Alder" },
  { text: "There is no standard normal. Normal is subjective. There are seven billion versions of normal on this planet.", author: "Matt Haig" },
  { text: "You're not a burden. You have a burden, which by definition is too heavy to carry on your own.", author: "Unknown" },
  { text: "Stars can't shine without darkness.", author: "D.H. Sidebottom" },
  { text: "It's okay to not be okay. It's not okay to stay that way.", author: "Unknown" },
];

const QUICK_RESOURCES = [
  {
    icon: 'clipboard-outline',
    label: 'Self Assessment',
    color: Colors.primary,
    description: 'Take a quick mental health screening questionnaire to understand where you are today.',
    action: 'assessment',
  },
  {
    icon: 'compass-outline',
    label: 'Wellness Guides',
    color: Colors.secondary,
    description: 'Step-by-step guides for managing anxiety, stress, sleep issues, and more.',
    action: 'guides',
  },
  {
    icon: 'book-outline',
    label: 'Expert Articles',
    color: Colors.tertiary,
    description: 'Read curated articles from licensed therapists and mental health professionals.',
    action: 'articles',
  },
  {
    icon: 'call-outline',
    label: 'Crisis Helpline',
    color: '#e57373',
    description: 'Immediate support when you need it most. Available 24/7.',
    action: 'crisis',
  },
];

export const HomeScreen = () => {
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();
  const C = useColors();
  const { locale, t } = useTranslation();
  const setFeedCache = usePostStore((state) => state.setFeedCache);
  const lowStimulation = useThemeStore((state) => state.lowStimulation);
  const isDark = C.surface === '#141412';
  const [communities, setCommunities] = useState<Community[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const graphAnim = useRef(new Animated.Value(0)).current;

  const todayMood = useMemo(() => {
    const todayKey = getDateKey(new Date());
    const todayReflection = reflections.find((reflection) => getDateKey(toDate(reflection.createdAt)) === todayKey);
    return todayReflection ? getReflectionMoodScore(todayReflection) : null;
  }, [reflections]);
  const weeklyMood = useMemo(() => buildMoodWeek(reflections), [reflections]);
  const weekRange = useMemo(() => formatMoodWeekRange(weeklyMood, locale), [locale, weeklyMood]);

  // Subscribe to real communities
  useEffect(() => {
    const unsub = subscribeToCommunities((data) => {
      setCommunities(data.slice(0, 3)); // Show top 3 on home
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setReflections([]);
      return;
    }
    return subscribeToUserReflections(user.uid, setReflections, 30);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = getFeedCacheKey('Trending', 'All', user?.uid);

    fetchFeedPage({
      mode: 'Trending',
      category: 'All',
      userId: user?.uid,
      pageSize: 20,
    })
      .then((page) => {
        if (!cancelled) setFeedCache(cacheKey, page.posts);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [setFeedCache, user?.uid]);

  useEffect(() => {
    graphAnim.setValue(0);
    Animated.timing(graphAnim, {
      toValue: 1,
      duration: lowStimulation ? 1 : 700,
      useNativeDriver: false,
    }).start();
  }, [graphAnim, lowStimulation, reflections.length]);

  // Auto-rotate quotes every 5 seconds
  useEffect(() => {
    if (lowStimulation) {
      fadeAnim.setValue(1);
      return undefined;
    }

    const interval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Pick a new random quote (avoid repeating same)
        setQuoteIndex((prev) => {
          let next = Math.floor(Math.random() * QUOTES.length);
          while (next === prev && QUOTES.length > 1) next = Math.floor(Math.random() * QUOTES.length);
          return next;
        });
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [fadeAnim, lowStimulation]);

  const navigateToCommunity = (community: Community) => {
    (navigation as any).navigate('ChatTab', {
      screen: 'CommunityChatRoom',
      params: {
        communityId: community.id,
        communityName: community.name,
        communityEmoji: community.emoji,
        membersCount: community.membersCount || 0,
        isMember: user ? community.members?.includes(user.uid) : false,
      },
    });
  };

  const handleResourcePress = (action: string) => {
    switch (action) {
      case 'assessment':
        navigation.navigate('SelfAssessment');
        break;
      case 'guides':
        navigation.navigate('CalmRoom');
        break;
      case 'articles':
        navigation.navigate('ExpertArticles');
        break;
      case 'crisis':
        Alert.alert(
          t('🆘 Crisis Resources'),
          t('If you or someone you know is in immediate danger, please contact:')
          + '\n\n• KIRAN Helpline: 1800-599-0019\n• Vandrevala Foundation: 1860-2662-345\n• iCall: 9152987821\n\n'
          + t('You are not alone. Help is always available.'),
          [
            { text: t('Call KIRAN Now'), onPress: () => Linking.openURL('tel:18005990019') },
            { text: t('Close'), style: 'cancel' },
          ]
        );
        break;
    }
  };

  const startEntryWithMood = (mood: typeof MOOD_OPTIONS[number]) => {
    navigation.navigate('WriteReflection', {
      moodScore: mood.score,
      moodLabel: mood.label,
      moodEmoji: mood.emoji,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── HERO ── */}
        <LinearGradient
          colors={lowStimulation ? [C.surfaceContainerLow, C.surfaceContainerLow, C.surface] : (isDark ? [C.primaryContainer, C.surfaceContainer, C.surface] : ['#c0ecda', '#c9e6fd', C.surface])}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
          pointerEvents="box-none"
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.logoRow}>
              <Image source={APP_LOGO} style={styles.logoMarkImg} />
              <Text style={[styles.logoText, { color: C.primary }]}>mindspace</Text>
            </View>
            <AppHeaderActions
              showSearch
              buttonStyle={{ backgroundColor: `${C.surfaceContainerHighest}99` }}
              avatarSize={38}
            />
          </View>

          {/* Hero text */}
          <View style={styles.heroBody}>
            <Text style={[styles.heroTitle, { color: C.onSurface }]}>You are{'\n'}<Text style={[styles.heroTitleItalic, { color: C.primary }]}>not alone.</Text></Text>
            <Text style={[styles.heroSub, { color: C.onSurfaceVariant }]}>
              A safe shelter for your thoughts. Connect with a community that understands, heals, and grows together through shared experience.
            </Text>
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: C.primary }]}
              onPress={() => (navigation as any).navigate('CommunityTab', { screen: 'CommunityFeed' })}
              activeOpacity={0.85}
            >
              <Text style={[styles.joinBtnText, { color: C.onPrimary }]}>Join the Space +</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exploreBtn, { backgroundColor: C.secondaryContainer }]}
              onPress={() => (navigation as any).navigate('CommunityTab', { screen: 'CommunityFeed' })}
              activeOpacity={0.85}
            >
              <Ionicons name="telescope-outline" size={16} color={C.onSecondaryContainer} />
              <Text style={[styles.exploreBtnText, { color: C.onSecondaryContainer }]}>Explore Stories +</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── MOOD CHECK-IN ── */}
        <View style={styles.moodSection}>
          <Text style={[styles.moodQ, { color: C.onSurface }]}>How are you feeling today?</Text>
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((mood) => (
              <TouchableOpacity
                key={mood.score}
                style={[styles.moodBtn, { backgroundColor: mood.color + '77' }, todayMood === mood.score && { backgroundColor: mood.color, ...Shadow.subtle }]}
                onPress={() => startEntryWithMood(mood)}
                activeOpacity={0.7}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.moodLabel, { color: C.onSurface }]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('MoodJournal')} activeOpacity={0.86}>
          <View style={[styles.resonanceCard, { backgroundColor: C.surfaceContainerLow }]}>
            <View style={styles.sectionRow}>
              <View>
                <Text style={[styles.resonanceTitle, { color: C.onSurface }]}>Weekly Resonance</Text>
                <Text style={[styles.resonanceSub, { color: C.onSurfaceVariant }]}>{weekRange || 'Your recent mood rhythm'}</Text>
              </View>
              <Ionicons name="analytics-outline" size={20} color={C.primary} />
            </View>
            <View style={styles.miniChart}>
              {weeklyMood.map((day) => {
                const height = day.score ? 18 + day.score * 11 : 10;
                const mood = day.score ? getMoodByScore(day.score) : null;
                return (
                  <View key={day.key} style={styles.miniDay}>
                    <View style={[styles.miniTrack, { backgroundColor: C.surfaceContainerHighest }]}>
                      <Animated.View
                        style={[
                          styles.miniBar,
                          {
                            backgroundColor: mood?.color || C.outlineVariant,
                            height: graphAnim.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.miniLabel, { color: C.onSurfaceVariant }]}>
                      {day.date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>

        {/* ── GUIDED RITUAL CARD ── */}
        <TouchableOpacity onPress={() => navigation.navigate('CalmRoom')} activeOpacity={0.88}>
          <LinearGradient
            colors={lowStimulation ? [C.surfaceContainerLow, C.surfaceContainerHigh] : [`${C.tertiaryContainer}CC`, `${C.secondaryContainer}99`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.ritualCard}
          >
            <View style={styles.ritualContent}>
              <Text style={[styles.ritualBadge, { color: C.onTertiaryContainer }]}>GUIDED RITUAL</Text>
              <Text style={[styles.ritualTitle, { color: C.onSurface }]}>Finding Stillness{'\n'}in the Storm</Text>
              <View style={styles.ritualMeta}>
                <View style={[styles.playCircle, { backgroundColor: C.primary }]}><Ionicons name="play" size={12} color={C.onPrimary} /></View>
                <Text style={[styles.ritualMetaText, { color: C.onSurfaceVariant }]}>10 min Guided Meditation</Text>
              </View>
            </View>
            <View style={styles.ritualIllo}>
              <Text style={{ fontSize: 64 }}>🧘</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── WRITE TODAY ── */}
        <TouchableOpacity onPress={() => navigation.navigate('WriteReflection', {})} activeOpacity={0.88}>
          <View style={[styles.writeCard, { backgroundColor: `${C.primaryContainer}88` }]}>
            <View style={[styles.writeIconCircle, { backgroundColor: `${C.primary}22` }]}>
              <Ionicons name="pencil-outline" size={18} color={C.primary} />
            </View>
            <View style={styles.writeText}>
              <Text style={[styles.writeTitle, { color: C.onSurface }]}>Write Today</Text>
              <Text style={[styles.writeSub, { color: C.onSurfaceVariant }]}>Release your thoughts into a private, secure journal.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.onSurfaceVariant} />
          </View>
        </TouchableOpacity>

        {/* ── NEED HELP ── */}
        <TouchableOpacity onPress={() => handleResourcePress('crisis')} activeOpacity={0.88}>
          <LinearGradient
            colors={(lowStimulation || isDark) ? [C.surfaceContainerLow, C.surfaceContainerHigh] : ['#f9d59b88', '#f4a9b033']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.helpCard}
          >
            <View style={[styles.helpIconCircle, { backgroundColor: isDark ? `${C.primary}22` : '#f4a9b033' }]}>
              <Ionicons name="heart-outline" size={22} color={isDark ? C.primary : '#c0612a'} />
            </View>
            <View style={styles.helpText}>
              <Text style={[styles.helpTitle, { color: C.onSurface }]}>Need Help?</Text>
              <Text style={[styles.helpSub, { color: C.onSurfaceVariant }]}>Connect with crisis resources and professional support instantly.</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── GROWING COMMUNITIES (REAL DATA) ── */}
        <View style={styles.padded}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Growing Communities</Text>
            <TouchableOpacity onPress={() => (navigation as any).navigate('ChatTab', { screen: 'ChatHome' })}>
              <Text style={[styles.viewAll, { color: C.primary }]}>View All <Ionicons name="chevron-forward" size={12} color={C.primary} /></Text>
            </TouchableOpacity>
          </View>
          {communities.length > 0 ? communities.map(c => (
            <TouchableOpacity key={c.id} style={[styles.commRow, { backgroundColor: C.surfaceContainerLow }]} onPress={() => navigateToCommunity(c)} activeOpacity={0.75}>
              <View style={[styles.commAvatar, { backgroundColor: C.primaryContainer }]}>
                <Text translate={false} style={{ fontSize: 20 }}>{c.emoji}</Text>
              </View>
              <View style={styles.commInfo}>
                <Text translate={false} style={[styles.commName, { color: C.onSurface }]}>{c.name}</Text>
                <Text style={[styles.commMeta, { color: C.onSurfaceVariant }]}>
                  {c.membersCount || 0} {t((c.membersCount || 0) === 1 ? 'member' : 'members')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          )) : (
            <View style={[styles.commRow, { backgroundColor: C.surfaceContainerLow }]}>
              <Text style={[styles.commMeta, { color: C.onSurfaceVariant }]}>Loading communities...</Text>
            </View>
          )}
        </View>

        {/* ── QUOTE CARD (auto-rotating every 5s) ── */}
        <View style={styles.padded}>
          <Card variant="elevated" style={styles.quoteCard}>
            <Text style={[styles.quoteMark, { color: C.primary }]}>"</Text>
            <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
              <Text style={[styles.quoteText, { color: C.onSurface }]}>
                {QUOTES[quoteIndex].text}
              </Text>
              <Text style={[styles.quoteAuthor, { color: C.onSurfaceVariant }]}>— {QUOTES[quoteIndex].author}</Text>
            </Animated.View>
          </Card>
        </View>

        {/* ── QUICK RESOURCES (WITH CONTENT) ── */}
        <View style={styles.padded}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Quick Resources</Text>
          <View style={styles.resourceGrid}>
            {QUICK_RESOURCES.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.resourceCard, { backgroundColor: C.surfaceContainerLow }]}
                activeOpacity={0.8}
                onPress={() => handleResourcePress(r.action)}
              >
                <View style={[styles.resourceIcon, { backgroundColor: `${r.color}18` }]}>
                  <Ionicons name={r.icon as any} size={24} color={r.color} />
                </View>
                <Text style={[styles.resourceLabel, { color: C.onSurface }]}>{r.label}</Text>
                <Text style={[styles.resourceDesc, { color: C.onSurfaceVariant }]}>{r.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const CARD_WIDTH = (width - Spacing[5] * 2 - Spacing[3]) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { gap: Spacing[4] },

  // HERO
  hero: { paddingTop: 56, paddingBottom: Spacing[6], paddingHorizontal: Spacing[5] },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[6] },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  logoMarkImg: { width: 30, height: 30, borderRadius: Radius.full },
  logoMarkText: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  logoText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  iconBtn: { width: 36, height: 36, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: { fontFamily: Typography.fontFamily.bold, fontSize: 10, lineHeight: 12 },

  heroBody: { gap: Spacing[4] },
  heroTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 38, lineHeight: 44, letterSpacing: 0 },
  heroTitleItalic: { fontFamily: Typography.fontFamily.bold, fontSize: 38, fontStyle: 'italic' },
  heroSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.6 },
  joinBtn: { borderRadius: Radius.full, paddingVertical: Spacing[3], paddingHorizontal: Spacing[6], alignSelf: 'flex-start' },
  joinBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.full, paddingVertical: Spacing[3], paddingHorizontal: Spacing[6], alignSelf: 'flex-start' },
  exploreBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },

  // MOOD
  moodSection: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  moodQ: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.lg },
  moodRow: { flexDirection: 'row', gap: Spacing[2] },
  moodBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing[3], borderRadius: Radius.xl, gap: 3 },
  moodEmoji: { fontSize: 22 },
  moodLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 9 },
  resonanceCard: { marginHorizontal: Spacing[5], borderRadius: 20, padding: Spacing[4], gap: Spacing[3] },
  resonanceTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  resonanceSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, marginTop: 2 },
  miniChart: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing[2] },
  miniDay: { flex: 1, alignItems: 'center', gap: 6 },
  miniTrack: { height: 82, width: '100%', maxWidth: 24, borderRadius: Radius.full, justifyContent: 'flex-end', overflow: 'hidden' },
  miniBar: { width: '100%', borderRadius: Radius.full },
  miniLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11 },

  // RITUAL
  ritualCard: { marginHorizontal: Spacing[5], borderRadius: 24, padding: Spacing[5], flexDirection: 'row', alignItems: 'center', minHeight: 140 },
  ritualContent: { flex: 1, gap: Spacing[2] },
  ritualBadge: { fontFamily: Typography.fontFamily.semiBold, fontSize: 10, letterSpacing: 0, textTransform: 'uppercase' },
  ritualTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, lineHeight: Typography.fontSize.xl * 1.3 },
  ritualMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginTop: 2 },
  playCircle: { width: 22, height: 22, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  ritualMetaText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  ritualIllo: { justifyContent: 'center', alignItems: 'center', marginLeft: Spacing[3] },

  // WRITE TODAY
  writeCard: {
    marginHorizontal: Spacing[5],
    borderRadius: 20, padding: Spacing[4], flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
  },
  writeIconCircle: { width: 40, height: 40, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  writeText: { flex: 1 },
  writeTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.lg },
  writeSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, marginTop: 2 },

  // NEED HELP
  helpCard: { marginHorizontal: Spacing[5], borderRadius: 20, padding: Spacing[4], flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  helpIconCircle: { width: 44, height: 44, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  helpText: { flex: 1 },
  helpTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.lg },
  helpSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, marginTop: 2 },

  // COMMUNITIES
  padded: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  viewAll: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  commRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], borderRadius: 16, paddingHorizontal: Spacing[4] },
  commAvatar: { width: 44, height: 44, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  commInfo: { flex: 1 },
  commName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  commMeta: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },

  // QUOTE
  quoteCard: { gap: Spacing[3], alignItems: 'center', paddingVertical: Spacing[5] },
  quoteMark: { fontFamily: Typography.fontFamily.extraBold, fontSize: 48, lineHeight: 44, alignSelf: 'flex-start' },
  quoteText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.lg, fontStyle: 'italic', lineHeight: Typography.fontSize.lg * 1.6, textAlign: 'center' },
  quoteAuthor: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },

  // RESOURCES
  resourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[3] },
  resourceCard: { width: CARD_WIDTH, borderRadius: 20, padding: Spacing[4], gap: Spacing[2], alignItems: 'flex-start' },
  resourceIcon: { width: 44, height: 44, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  resourceLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  resourceDesc: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, lineHeight: Typography.fontSize.xs * 1.5 },
});
