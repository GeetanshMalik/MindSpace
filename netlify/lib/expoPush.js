const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_CHUNK_SIZE = 100;

const titleForNotification = (type) => {
  switch (type) {
    case 'like':
      return 'New Like';
    case 'solidarity':
      return 'New Solidarity';
    case 'comment':
      return 'New Comment';
    case 'message':
      return 'New Message';
    case 'friend_request':
      return 'Friend Request';
    case 'friend_accepted':
      return 'Friend Accepted';
    case 'streak':
      return 'Streak Reminder';
    case 'reminder':
      return 'Mindspace Reminder';
    case 'community':
      return 'Community Update';
    default:
      return 'Mindspace';
  }
};

const compactData = (value) => {
  const data = {};

  Object.entries(value).forEach(([key, item]) => {
    if (item !== undefined && item !== null && item !== '') {
      data[key] = item;
    }
  });

  return data;
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const sendExpoPushNotifications = async (tokens, notification, targetUserId) => {
  const uniqueTokens = Array.from(new Set(tokens)).filter(Boolean);
  if (!uniqueTokens.length) {
    return { attempted: 0, delivered: 0, invalidTokens: [] };
  }

  const messages = uniqueTokens.map((token) => ({
    to: token,
    sound: 'default',
    title: titleForNotification(notification.type),
    body: notification.text,
    data: compactData({
      type: notification.type,
      targetUserId,
      fromUserId: notification.fromUserId,
      postId: notification.postId,
      commentId: notification.commentId,
      chatId: notification.chatId,
      friendshipId: notification.friendshipId,
      channelId: 'messages',
    }),
    channelId: 'messages',
    priority: 'high',
  }));

  let delivered = 0;
  const invalidTokens = [];

  for (const messageChunk of chunk(messages, EXPO_PUSH_CHUNK_SIZE)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageChunk),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('Expo push request failed:', response.status, payload);
      continue;
    }

    const results = Array.isArray(payload.data) ? payload.data : [payload.data];
    results.forEach((result, index) => {
      if (result?.status === 'ok') {
        delivered += 1;
        return;
      }

      if (result?.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(messageChunk[index].to);
      } else if (result?.status === 'error') {
        console.warn('Expo push message failed:', result);
      }
    });
  }

  return {
    attempted: uniqueTokens.length,
    delivered,
    invalidTokens,
  };
};

module.exports = {
  sendExpoPushNotifications,
};
