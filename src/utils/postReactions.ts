import { Post } from '../services/firebase/firestore';

export type ReactionField = 'likes' | 'solidarity';

const getCountField = (field: ReactionField) =>
  field === 'likes' ? 'likesCount' : 'solidarityCount';

export const getReactionCount = (post: Post, field: ReactionField) => {
  const countField = getCountField(field);
  return Array.isArray(post[field])
    ? post[field]!.length
    : typeof post[countField] === 'number' ? post[countField] as number : 0;
};

export const hasUserReaction = (post: Post, field: ReactionField, userId?: string | null) =>
  !!userId && Array.isArray(post[field]) && post[field]!.includes(userId);

export const applyPostReaction = (
  post: Post,
  userId: string,
  field: ReactionField,
  active: boolean
): Post => {
  const countField = getCountField(field);
  const values = Array.isArray(post[field]) ? post[field]! : [];
  const currentlyActive = values.includes(userId);

  if (currentlyActive === active) return post;

  const nextValues = active
    ? Array.from(new Set([...values, userId]))
    : values.filter((id) => id !== userId);
  const delta = active ? 1 : -1;
  const currentCount = getReactionCount(post, field);
  const currentScore = typeof post.engagementScore === 'number'
    ? post.engagementScore
    : getReactionCount(post, 'likes') + getReactionCount(post, 'solidarity');

  return {
    ...post,
    [field]: nextValues,
    [countField]: Math.max(0, currentCount + delta),
    engagementScore: Math.max(0, currentScore + delta),
  };
};
