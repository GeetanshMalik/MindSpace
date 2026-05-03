import { Reflection } from '../services/firebase/firestore';

export const MOOD_OPTIONS = [
  { score: 1, emoji: '😔', label: 'Low', color: '#f4a9b0' },
  { score: 2, emoji: '😕', label: 'Meh', color: '#f9d59b' },
  { score: 3, emoji: '😐', label: 'Okay', color: '#fff59d' },
  { score: 4, emoji: '🙂', label: 'Good', color: '#b5ead7' },
  { score: 5, emoji: '😊', label: 'Great', color: '#b5d3f5' },
];

const LEGACY_MOOD_SCORE: Record<string, number> = {
  sad: 1,
  anxious: 2,
  angry: 2,
  calm: 4,
  happy: 5,
  grateful: 5,
};

export type MoodOption = typeof MOOD_OPTIONS[number];

export const getMoodByScore = (score?: number | null) =>
  MOOD_OPTIONS.find((mood) => mood.score === score) || null;

export const getMoodByLabel = (label?: string | null) => {
  const normalized = label?.toLowerCase();
  const direct = MOOD_OPTIONS.find((mood) => mood.label.toLowerCase() === normalized);
  if (direct) return direct;
  return getMoodByScore(normalized ? LEGACY_MOOD_SCORE[normalized] : null);
};

export const getReflectionMoodScore = (reflection: Reflection) => {
  if (typeof reflection.moodScore === 'number') return reflection.moodScore;
  return getMoodByLabel(reflection.mood)?.score || null;
};

export const getReflectionMoodEmoji = (reflection: Reflection) => {
  if (reflection.moodEmoji) return reflection.moodEmoji;
  const score = getReflectionMoodScore(reflection);
  return getMoodByScore(score)?.emoji || null;
};

export const toDate = (value: any) => {
  if (!value) return new Date(0);
  if (value.toDate) return value.toDate();
  if (typeof value === 'number') return new Date(value * 1000);
  return new Date(value);
};

export const getDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildMoodWeek = (reflections: Reflection[], today = new Date()) => {
  const todayKey = getDateKey(today);
  const moodsByDate = new Map<string, { scores: number[]; reflections: Reflection[] }>();

  reflections.forEach((reflection) => {
    const score = getReflectionMoodScore(reflection);
    if (!score) return;
    const key = getDateKey(toDate(reflection.createdAt));
    const day = moodsByDate.get(key) || { scores: [], reflections: [] };
    day.scores.push(score);
    day.reflections.push(reflection);
    moodsByDate.set(key, day);
  });

  const includesToday = moodsByDate.has(todayKey);
  const end = new Date(today);
  if (!includesToday) end.setDate(end.getDate() - 1);

  const start = new Date(end);
  start.setDate(end.getDate() - 6);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = getDateKey(date);
    const day = moodsByDate.get(key);
    const averageScore = day?.scores.length
      ? day.scores.reduce((sum, value) => sum + value, 0) / day.scores.length
      : null;
    const score = averageScore ? Math.max(1, Math.min(5, Math.round(averageScore))) : null;
    return {
      key,
      date,
      score,
      averageScore,
      entryCount: day?.scores.length || 0,
      mood: getMoodByScore(score),
      reflections: day?.reflections || [],
    };
  });
};

export const formatMoodWeekRange = (week: ReturnType<typeof buildMoodWeek>, locale = 'en-US') => {
  if (!week.length) return '';
  const first = week[0].date;
  const last = week[week.length - 1].date;
  return `${first.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
};
