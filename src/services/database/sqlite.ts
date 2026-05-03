import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('mindspace.db');
  }
  return db;
}

export const initDatabase = () => {
  try {
    getDb().execSync(`
      CREATE TABLE IF NOT EXISTS mood_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        mood_score INTEGER NOT NULL,
        emoji TEXT,
        note TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tags TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
  } catch (e) {
    console.warn('Failed to init database:', e);
  }
};

// Mood Logs
export const saveMoodLog = (moodScore: number, emoji: string, note: string, date: string) => {
  getDb().runSync(
    'INSERT INTO mood_logs (date, mood_score, emoji, note) VALUES (?, ?, ?, ?)',
    [date, moodScore, emoji, note]
  );
};

export const getMoodLogs = (): any[] => {
  return getDb().getAllSync('SELECT * FROM mood_logs ORDER BY created_at DESC LIMIT 30');
};

export const getTodayMood = (date: string): any => {
  return getDb().getFirstSync('SELECT * FROM mood_logs WHERE date = ? LIMIT 1', [date]);
};

// Reflections
export const saveReflection = (title: string, body: string, tags: string) => {
  getDb().runSync(
    'INSERT INTO reflections (title, body, tags) VALUES (?, ?, ?)',
    [title, body, tags]
  );
};

export const getReflections = (): any[] => {
  return getDb().getAllSync('SELECT * FROM reflections ORDER BY created_at DESC');
};

export const updateReflection = (id: number, title: string, body: string, tags: string) => {
  getDb().runSync(
    'UPDATE reflections SET title = ?, body = ?, tags = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?',
    [title, body, tags, id]
  );
};

export const deleteReflection = (id: number) => {
  getDb().runSync('DELETE FROM reflections WHERE id = ?', [id]);
};
