import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useTranslation } from '../../i18n/useTranslation';

type Author = { name: string; role: string };
type ArticleSeed = {
  title: string;
  category: string;
  principle: string;
  practice: string;
  reflection: string;
  color: string;
};
type Article = ArticleSeed & Author & { minutes: number; summary: string; body: string[] };

const AUTHORS: Author[] = [
  { name: 'Jon Kabat-Zinn', role: 'mindfulness teacher and author' },
  { name: 'Kristin Neff', role: 'self-compassion researcher' },
  { name: 'Dan Siegel', role: 'psychiatrist and author' },
  { name: 'Marc Brackett', role: 'emotion scientist' },
  { name: 'Brene Brown', role: 'researcher and author' },
  { name: 'Thich Nhat Hanh', role: 'mindfulness teacher' },
  { name: 'Viktor Frankl', role: 'psychiatrist and author' },
  { name: 'Gabor Mate', role: 'physician and author' },
  { name: 'Judson Brewer', role: 'psychiatrist and researcher' },
  { name: 'Tara Brach', role: 'psychologist and meditation teacher' },
  { name: 'Rick Hanson', role: 'psychologist and author' },
  { name: 'Susan David', role: 'psychologist and author' },
  { name: 'Andrew Huberman', role: 'neuroscientist' },
  { name: 'Lisa Feldman Barrett', role: 'neuroscientist and author' },
  { name: 'Pema Chodron', role: 'meditation teacher and author' },
  { name: 'Sharon Salzberg', role: 'meditation teacher and author' },
  { name: 'Daniel Goleman', role: 'psychologist and author' },
  { name: 'James Clear', role: 'habit researcher and author' },
  { name: 'Esther Perel', role: 'psychotherapist and author' },
  { name: 'Laurie Santos', role: 'psychologist and professor' },
];

const COLORS = ['#9fd8cb', '#f1c98d', '#b7c8f2', '#d4b5ea', '#efb1b1', '#c4d79b', '#91d3d8', '#efc6a7'];

const ARTICLE_SEEDS: ArticleSeed[] = [
  ['Returning to the Breath', 'Mindfulness', 'attention is trained by returning, not by staying perfect', 'take three normal breaths and silently say back when the mind wanders', 'What anchor feels easiest today?'],
  ['A Kinder Inner Voice', 'Self-kindness', 'self-correction works better when it is not wrapped in shame', 'write one sentence to yourself as if you were speaking to a close friend', 'Where did you need kindness today?'],
  ['The Window of Tolerance', 'Nervous system', 'stress can push the body above or below its workable range', 'notice whether you feel activated, shut down, or steady before choosing a tool', 'What state is your body in right now?'],
  ['Name It to Tame It', 'Emotional literacy', 'precise emotion words make feelings easier to work with', 'replace fine with one closer word such as disappointed, tense, lonely, or relieved', 'What is the most honest word for this feeling?'],
  ['Asking for Real Support', 'Connection', 'support becomes easier when the request is specific', 'send one direct request such as can you listen for ten minutes', 'Who has earned a small honest update from you?'],
  ['One Mindful Step', 'Presence', 'peace is easier to practice in small movements than in perfect conditions', 'walk slowly for one minute and feel each foot land', 'What changed when you slowed one action?'],
  ['Meaning in a Hard Moment', 'Resilience', 'people can often choose a meaningful next action even when they cannot choose the situation', 'ask what this moment is asking from me in the next five minutes', 'What tiny action would honor your values?'],
  ['The Body Keeps Score', 'Trauma awareness', 'the body may hold stress before the mind can explain it', 'scan jaw, shoulders, chest, belly, and hands without forcing relaxation', 'Where does your body ask for gentleness?'],
  ['Cravings as Waves', 'Habits', 'urges rise, peak, and fall when we observe them with curiosity', 'track an urge for ninety seconds and name its shape, temperature, and movement', 'What urge could you watch instead of obeying?'],
  ['The RAIN Pause', 'Meditation', 'recognizing and allowing feelings can soften the fight against them', 'recognize, allow, investigate kindly, and nurture for two quiet minutes', 'What feeling needs permission to exist?'],
  ['Taking in the Good', 'Positive neuroplasticity', 'pleasant moments deepen when attention stays with them briefly', 'notice one good thing and let it register for twenty seconds', 'What small good thing can you let land?'],
  ['Emotional Agility', 'Emotions', 'feelings are data, not commands', 'write I am noticing the feeling of before the emotion word', 'What feeling is trying to give you information?'],
  ['Light, Breath, and Energy', 'Body rhythm', 'simple body signals can shift alertness and mood', 'step near daylight, breathe through the nose, and relax the exhale', 'What physical cue would support your energy?'],
  ['Emotions Are Built', 'Mind science', 'the brain predicts and labels body signals using context', 'ask what else could this sensation mean besides the first story', 'What context might be shaping this emotion?'],
  ['Staying With Discomfort', 'Acceptance', 'running from discomfort can make it feel larger', 'stay with one safe uncomfortable sensation for five breaths', 'What can you allow without fixing right away?'],
  ['Loving-Kindness in Practice', 'Compassion', 'warmth can be practiced like attention', 'repeat may I be safe, may I be steady, may I be kind', 'Who else could receive that same wish?'],
  ['Listening Before Reacting', 'Emotional intelligence', 'a pause creates space between impulse and action', 'take one breath before replying to a difficult message', 'Where would a pause protect your peace?'],
  ['The Two-Minute Habit', 'Habits', 'small actions become reliable when they are easy to start', 'choose a habit so small it feels almost too easy', 'What tiny habit would help your future self?'],
  ['Repair After Conflict', 'Relationships', 'repair matters more than never making mistakes', 'name your part, name the impact, and ask what would help now', 'What relationship needs a small repair?'],
  ['Happiness as a Skill', 'Wellbeing', 'wellbeing grows through attention, connection, gratitude, and rest', 'write three specific good things from the last twenty-four hours', 'What good thing did your mind nearly skip?'],
  ['A Grounded Morning', 'Routine', 'the first minutes of the day can cue the nervous system', 'before checking your phone, feel your feet and take five slow breaths', 'What morning cue would help you begin softly?'],
  ['Letting Thoughts Pass', 'Mindfulness', 'thoughts can be noticed without being followed', 'label a thought planning, judging, remembering, or worrying', 'Which thought label showed up most today?'],
  ['Self-Compassion Break', 'Self-kindness', 'pain softens when met with common humanity', 'say this is hard, others feel this too, may I be kind to myself', 'What would make this moment one percent kinder?'],
  ['High Activation Reset', 'Nervous system', 'longer exhales can signal safety to the body', 'inhale for four and exhale for six for five rounds', 'Did your body shift after the longer exhale?'],
  ['The Feeling Wheel', 'Emotional literacy', 'a wider vocabulary creates more choices', 'pick a broad feeling, then choose two more precise words under it', 'What word helped you understand yourself?'],
  ['Belonging Without Performing', 'Connection', 'secure connection does not require constant usefulness', 'message someone without proving anything, just share one true sentence', 'Where do you feel accepted without effort?'],
  ['Mindful Eating', 'Presence', 'ordinary routines can become grounding practices', 'take three bites slowly and notice texture, warmth, and taste', 'What did slowing down reveal?'],
  ['Purpose in Small Acts', 'Resilience', 'meaning often arrives through service, courage, or honesty', 'choose one useful act that fits your current energy', 'What small act would feel meaningful today?'],
  ['Safety Before Story', 'Trauma awareness', 'a dysregulated body can make every story feel urgent', 'orient to the room by naming five neutral objects', 'What looks safe or neutral around you?'],
  ['Interrupting Loops', 'Habits', 'awareness weakens automatic loops', 'write trigger, behavior, reward for one repeated habit', 'What reward is the habit trying to give you?'],
  ['Softening Resistance', 'Meditation', 'acceptance starts by noticing the fight inside the feeling', 'ask can I let this be here for one breath', 'What did resistance feel like in the body?'],
  ['Building Inner Resources', 'Positive neuroplasticity', 'confidence grows when the brain remembers evidence of coping', 'recall one time you got through something difficult', 'What strength did that moment prove?'],
  ['Values Over Mood', 'Emotions', 'you can act by values even when mood is low', 'choose one action that matches care, honesty, courage, or rest', 'Which value wants attention today?'],
  ['The Physiological Sigh', 'Body rhythm', 'a double inhale and long exhale can quickly reduce tension', 'take a small second inhale at the top, then exhale slowly', 'Where did tension loosen?'],
  ['Reframing Predictions', 'Mind science', 'the mind often treats predictions like facts', 'write one stressful prediction and three other possible outcomes', 'What else could be true?'],
  ['Meeting Fear Kindly', 'Acceptance', 'fear becomes easier to hold when it is not treated as failure', 'place a hand on the chest and say fear is here, and I can move slowly', 'What does fear want to protect?'],
  ['Compassion for the Difficult Person', 'Compassion', 'compassion can include boundaries', 'wish someone well from a distance without excusing harmful behavior', 'Where do you need compassion with a boundary?'],
  ['The Pause Button', 'Emotional intelligence', 'naming the urge before acting reduces reactivity', 'say I am having the urge to before the action', 'What urge could use a pause?'],
  ['Habit Stacking for Calm', 'Habits', 'new habits stick better when attached to existing routines', 'after brushing teeth, take one slow breath and relax your shoulders', 'What existing habit can hold a calming habit?'],
  ['Listening to Loneliness', 'Relationships', 'loneliness points toward the need for contact, not personal failure', 'reach out with a low-pressure message or voice note', 'What kind of contact would feel nourishing?'],
  ['Savoring Good Moments', 'Wellbeing', 'small joys become stronger when noticed deliberately', 'describe one pleasant moment using all five senses', 'What moment deserves to be remembered?'],
  ['Evening Shutdown', 'Routine', 'closure helps the mind release unfinished loops', 'write done, not done, and tomorrow for three minutes', 'What can wait until tomorrow?'],
  ['Observing the Inner Critic', 'Mindfulness', 'the critic is a mental event, not the whole self', 'name the critic voice and thank it for trying to protect you', 'What is the critic afraid would happen?'],
  ['Repairing Self-Trust', 'Self-kindness', 'self-trust grows through small promises kept', 'make one promise you can keep in under five minutes', 'What promise is small enough to keep today?'],
  ['Downshifting Before Sleep', 'Nervous system', 'the body needs signals that the day is complete', 'dim the room, slow your exhale, and unclench the jaw', 'What signal tells your body the day is ending?'],
  ['Mood Is Not Identity', 'Emotional literacy', 'a mood is something passing through, not who you are', 'say a part of me feels instead of I am', 'What part of you needs care?'],
  ['Safe Sharing', 'Connection', 'healthy openness is paced and selective', 'share one honest sentence with one trustworthy person', 'What would be enough to share today?'],
  ['Tea as Meditation', 'Presence', 'warmth and repetition can steady attention', 'hold a warm cup and notice heat, scent, and breath', 'What ordinary object can anchor you?'],
  ['Courage in Small Form', 'Resilience', 'courage is often quiet and practical', 'do one avoided task for five minutes only', 'What small brave step is available?'],
  ['Orienting After Stress', 'Trauma awareness', 'looking around slowly helps update the body that the moment has changed', 'turn your head and let your eyes land on safe details', 'What tells you this moment is different from the past?'],
  ['Changing the Reward', 'Habits', 'habits shift when the reward is understood and replaced', 'after a stress trigger, try water, walking, or one message instead', 'What healthier reward could meet the same need?'],
  ['Noticing Aversion', 'Meditation', 'aversion is the mind saying no to what is already present', 'find the no in your body and breathe around it', 'What softened when you stopped arguing?'],
  ['Remembering Strength', 'Positive neuroplasticity', 'strength becomes more available when intentionally remembered', 'write one sentence: I have handled hard things before', 'What proof of strength did you forget?'],
  ['Permission to Feel', 'Emotions', 'emotions move more cleanly when they are allowed', 'set a two-minute timer and let the feeling be felt safely', 'What emotion needed permission?'],
  ['NSDR for Rest', 'Body rhythm', 'deep rest can support recovery even without sleep', 'lie down and follow a slow body scan from face to feet', 'Where did your body release effort?'],
  ['Prediction Versus Reality', 'Mind science', 'checking predictions can reduce anxious certainty', 'write what I predict and what actually happened later', 'What did reality teach the prediction?'],
  ['Making Room for Uncertainty', 'Acceptance', 'uncertainty can be carried without being solved immediately', 'say maybe, maybe not, and return to the next useful action', 'What can you do while uncertainty remains?'],
  ['Compassionate Boundaries', 'Compassion', 'kindness can say no clearly', 'write a boundary that is short, warm, and direct', 'Where would a kind no protect your peace?'],
  ['The Repair Breath', 'Emotional intelligence', 'one breath before an apology can make it cleaner', 'breathe, name the impact, and avoid defending the first sentence', 'What repair would be helped by calm?'],
  ['Make It Obvious', 'Habits', 'environment shapes behavior more than motivation alone', 'place the journal, water, or walking shoes where you will see them', 'What helpful cue can you put in your path?'],
  ['A Question for Love', 'Relationships', 'curiosity lowers defensiveness in close relationships', 'ask what did that feel like for you before explaining your side', 'Where could curiosity change the tone?'],
  ['Gratitude Without Pressure', 'Wellbeing', 'gratitude works best when it is specific and honest', 'write one thing you genuinely appreciated, however small', 'What appreciation feels real, not forced?'],
].map(([title, category, principle, practice, reflection], index) => ({
  title,
  category,
  principle,
  practice,
  reflection,
  color: COLORS[index % COLORS.length],
}));

const QUOTES = [
  { text: 'Peace is every step.', author: 'Thich Nhat Hanh' },
  { text: 'Wherever you go, there you are.', author: 'Jon Kabat-Zinn' },
  { text: 'Courage starts with showing up.', author: 'Brene Brown' },
  { text: 'Feelings are data, not directives.', author: 'Susan David' },
  { text: 'Between stimulus and response there is a space.', author: 'Viktor Frankl' },
];

const buildArticle = (seed: ArticleSeed, index: number): Article => {
  const author = AUTHORS[index % AUTHORS.length];
  const body = [
    `${author.name}'s work invites a practical question: how can this idea become useful inside an ordinary day? ${seed.principle}. That turns the article from inspiration into something the nervous system can actually practice.`,
    `Start by lowering the pressure. You do not need a perfect mood, a quiet room, or a long routine. You need one repeatable move that is simple enough to use when life is already busy.`,
    `Try this today: ${seed.practice}. Do it once, then notice what changed in the body, the breath, or the next thought. The point is not to force peace. The point is to create a small opening where choice can return.`,
    `If the practice feels awkward, make it smaller. If it feels helpful, repeat it at the same time tomorrow. Mental wellness grows through these modest repetitions, not through dramatic promises that are hard to keep.`,
    `Reflection: ${seed.reflection} Write one honest sentence, then close the exercise. Let that be enough for today.`,
  ];

  return {
    ...seed,
    ...author,
    minutes: 5 + (index % 5),
    summary: `A practical ${seed.category.toLowerCase()} read inspired by ${author.name}, with one small exercise you can use today.`,
    body,
  };
};

const ARTICLE_LIBRARY = ARTICLE_SEEDS.map(buildArticle);

const randomArticles = () =>
  ARTICLE_LIBRARY
    .map((article) => ({ article, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, 10)
    .map(({ article }) => article);

export const ExpertArticlesScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { language, t } = useTranslation();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [articles, setArticles] = useState<Article[]>(() => randomArticles());
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const fade = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      setArticles(randomArticles());
    }, [])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setQuoteIndex((value) => (value + 1) % QUOTES.length);
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [fade]);

  const getArticleTitle = (article: Article) => {
    const translatedTitle = t(article.title);
    return language === 'en' || translatedTitle !== article.title
      ? translatedTitle
      : t(article.category);
  };

  const getArticleSummary = (article: Article) =>
    language === 'en' ? article.summary : t('A practical wellness read with one small exercise you can use today.');

  const getArticleBody = (article: Article) => {
    if (language === 'en') return article.body;
    const translatedPrinciple = t(article.principle);
    const translatedPractice = t(article.practice);
    const translatedReflection = t(article.reflection);
    return [
      t('This wellness note offers a practical way to pause, notice what is happening, and choose one gentle next step.'),
      `${t('Core idea')}: ${translatedPrinciple === article.principle ? t('Wellness Practice') : translatedPrinciple}`,
      `${t('Try this today')}: ${translatedPractice === article.practice ? t('Take one slow breath, soften your shoulders, and notice the next useful step.') : translatedPractice}`,
      `${t('Reflection')}: ${translatedReflection === article.reflection ? t('What small action would support you today?') : translatedReflection}`,
      t('Let one honest sentence be enough for today.'),
    ];
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <LinearGradient
        colors={[C.tertiaryContainer, `${C.tertiary}18`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <View style={styles.heroContent}>
          <Ionicons name="book-outline" size={34} color={C.onSurface} />
          <Text style={[styles.heroTitle, { color: C.onSurface }]}>Expert Articles</Text>
          <Text style={[styles.heroSub, { color: C.onSurfaceVariant }]}>Ten fresh reads from a 60-article wellness library, refreshed whenever you enter.</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.quoteCard, { backgroundColor: C.surfaceContainerLow }]}>
          <Animated.View style={{ opacity: fade }}>
            <Text style={[styles.quoteText, { color: C.onSurface }]}>"{QUOTES[quoteIndex].text}"</Text>
            <Text style={[styles.quoteAuthor, { color: C.onSurfaceVariant }]}>- {QUOTES[quoteIndex].author}</Text>
          </Animated.View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Today's Selection</Text>
          <Text style={[styles.sectionSub, { color: C.onSurfaceVariant }]}>Showing 10 of {ARTICLE_LIBRARY.length} article cards.</Text>
        </View>

        {articles.map((article) => (
          <TouchableOpacity key={`${article.title}-${article.name}`} onPress={() => setSelectedArticle(article)} activeOpacity={0.86}>
            <View style={[styles.articleCard, { backgroundColor: C.surfaceContainerLow }]}>
              <View style={[styles.articleStripe, { backgroundColor: article.color }]} />
              <View style={styles.articleBody}>
                <View style={styles.articleMetaRow}>
                  <Text style={[styles.articleCategory, { color: C.primary }]}>{t(article.category)}</Text>
                  <Text style={[styles.articleTime, { color: C.onSurfaceVariant }]}>{article.minutes} {t('min')}</Text>
                </View>
                <Text style={[styles.articleTitle, { color: C.onSurface }]}>{getArticleTitle(article)}</Text>
                <Text style={[styles.articleAuthor, { color: C.onSurfaceVariant }]}>
                  {article.name} - {t(article.role)}
                </Text>
                <Text style={[styles.articleSummary, { color: C.onSurfaceVariant }]}>{getArticleSummary(article)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        ))}

        <View style={[styles.disclaimerCard, { backgroundColor: C.surfaceContainerLow }]}>
          <Ionicons name="information-circle-outline" size={20} color={C.primary} />
          <Text style={[styles.disclaimerText, { color: C.onSurfaceVariant }]}>
            These are original MindSpace wellness summaries inspired by real authors and researchers. They are educational, not medical diagnosis or emergency care.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={!!selectedArticle} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedArticle(null)}>
        <View style={[styles.modal, { backgroundColor: C.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: C.outlineVariant + '55' }]}>
            <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={C.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: C.onSurface }]}>Article</Text>
            <View style={styles.modalClose} />
          </View>

          {selectedArticle ? (
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.modalAccent, { backgroundColor: selectedArticle.color }]} />
              <Text style={[styles.modalCategory, { color: C.primary }]}>{t(selectedArticle.category)}</Text>
              <Text style={[styles.modalTitle, { color: C.onSurface }]}>{getArticleTitle(selectedArticle)}</Text>
              <Text style={[styles.modalAuthor, { color: C.onSurfaceVariant }]}>
                {t('Inspired by')} {selectedArticle.name} - {t(selectedArticle.role)}
              </Text>
              {getArticleBody(selectedArticle).map((paragraph, index) => (
                <Text key={`${selectedArticle.title}-${index}`} style={[styles.paragraph, { color: C.onSurface }]}>
                  {paragraph}
                </Text>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingTop: 60, paddingBottom: Spacing[7], paddingHorizontal: Spacing[5] },
  backBtn: { alignSelf: 'flex-start', marginBottom: Spacing[4] },
  heroContent: { alignItems: 'center', gap: Spacing[2] },
  heroTitle: { fontFamily: Typography.fontFamily.extraBold, fontSize: Typography.fontSize['3xl'] },
  heroSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.5, textAlign: 'center' },
  content: { padding: Spacing[5], gap: Spacing[3], paddingBottom: 50 },
  quoteCard: { borderRadius: 22, padding: Spacing[5], minHeight: 118, justifyContent: 'center' },
  quoteText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, lineHeight: Typography.fontSize.xl * 1.35 },
  quoteAuthor: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, marginTop: Spacing[2] },
  sectionHeader: { gap: Spacing[1], marginTop: Spacing[2] },
  sectionTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  sectionSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  articleCard: { borderRadius: 20, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  articleStripe: { width: 8, alignSelf: 'stretch' },
  articleBody: { flex: 1, padding: Spacing[4], gap: Spacing[1] },
  articleMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  articleCategory: { fontFamily: Typography.fontFamily.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0 },
  articleTime: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs },
  articleTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, lineHeight: Typography.fontSize.lg * 1.25, marginTop: Spacing[1] },
  articleAuthor: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.xs },
  articleSummary: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.45, marginTop: Spacing[2] },
  disclaimerCard: { borderRadius: 18, padding: Spacing[4], flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], marginTop: Spacing[2] },
  disclaimerText: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.45 },
  modal: { flex: 1 },
  modalHeader: { paddingTop: 58, paddingBottom: Spacing[3], paddingHorizontal: Spacing[5], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  modalClose: { width: 40, height: 40, justifyContent: 'center' },
  modalHeaderTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  modalContent: { padding: Spacing[5], gap: Spacing[3], paddingBottom: 60 },
  modalAccent: { height: 8, borderRadius: Radius.full, marginBottom: Spacing[2] },
  modalCategory: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xs, textTransform: 'uppercase', letterSpacing: 0 },
  modalTitle: { fontFamily: Typography.fontFamily.extraBold, fontSize: Typography.fontSize['2xl'], lineHeight: Typography.fontSize['2xl'] * 1.25 },
  modalAuthor: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, marginBottom: Spacing[2] },
  paragraph: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.65 },
});
