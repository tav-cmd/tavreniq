import {rank} from './core.js';
export function createQuizStore(db) {
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id TEXT PRIMARY KEY, guild TEXT NOT NULL, channel TEXT NOT NULL, starter TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', questions TEXT NOT NULL, seconds INTEGER NOT NULL,
      played INTEGER NOT NULL DEFAULT 0, message TEXT, created TEXT NOT NULL, ended TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS quiz_one_active ON quiz_sessions(guild,channel) WHERE status='active';
    CREATE INDEX IF NOT EXISTS quiz_guild_status ON quiz_sessions(guild,status);
    CREATE TABLE IF NOT EXISTS quiz_answers (
      session TEXT NOT NULL REFERENCES quiz_sessions(id), question INTEGER NOT NULL,
      user TEXT NOT NULL, name TEXT NOT NULL, choice INTEGER NOT NULL CHECK(choice BETWEEN 0 AND 3),
      correct INTEGER NOT NULL CHECK(correct IN (0,1)),
      PRIMARY KEY(session,question,user));
    CREATE INDEX IF NOT EXISTS quiz_answer_session_user ON quiz_answers(session,user);`);
  const get=id=>{
    const r=db.prepare('SELECT * FROM quiz_sessions WHERE id=?').get(id);
    return r?{...r,questions:JSON.parse(r.questions)}:null;
  };
  return {
    get,
    start(s) {db.prepare('INSERT INTO quiz_sessions(id,guild,channel,starter,questions,seconds,created) VALUES(?,?,?,?,?,?,?)')
      .run(s.id,s.guild,s.channel,s.starter,JSON.stringify(s.questions),s.seconds,new Date().toISOString());},
    progress(id,played,message) {db.prepare("UPDATE quiz_sessions SET played=?,message=? WHERE id=? AND status='active'").run(played,message,id);},
    answer(id,index,user,name,choice,correct) {
      return db.prepare(`INSERT OR IGNORE INTO quiz_answers(session,question,user,name,choice,correct)
        SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM quiz_sessions WHERE id=? AND status='active')`)
        .run(id,index,user,name,choice,Number(correct),id).changes===1;
    },
    finish(id,status) {
      if(!['completed','cancelled','interrupted','failed'].includes(status)) throw new Error('Invalid quiz status.');
      db.prepare("UPDATE quiz_sessions SET status=?,ended=? WHERE id=? AND status='active'").run(status,new Date().toISOString(),id);
    },
    recover() {
      const rows=db.prepare("SELECT id FROM quiz_sessions WHERE status='active'").all().map(r=>get(r.id));
      db.prepare("UPDATE quiz_sessions SET status='interrupted',ended=? WHERE status='active'").run(new Date().toISOString());
      return rows;
    },
    results(id) {
      const session=get(id);
      if(!session) return null;
      const rows=db.prepare(`SELECT a.user,
        (SELECT b.name FROM quiz_answers b WHERE b.session=a.session AND b.user=a.user ORDER BY b.question DESC LIMIT 1) AS name,
        COUNT(*) AS answered,SUM(a.correct) AS correct FROM quiz_answers a WHERE a.session=? GROUP BY a.user`).all(id);
      return {session,players:rank(rows.map(r=>({...r,played:session.played})))};
    },
    latest(guild,channel) {return db.prepare("SELECT id FROM quiz_sessions WHERE guild=? AND channel=? AND status!='active' ORDER BY rowid DESC LIMIT 1").get(guild,channel)?.id;},
    leaderboard(guild) {
      const rows=db.prepare(`WITH scores AS (
        SELECT a.user,a.session,COUNT(*) AS answered,SUM(a.correct) AS correct,s.played
        FROM quiz_answers a JOIN quiz_sessions s ON s.id=a.session
        WHERE s.guild=? AND s.status='completed' GROUP BY a.user,a.session)
        SELECT user,SUM(answered) AS answered,SUM(correct) AS correct,SUM(played) AS played,COUNT(*) AS games
        FROM scores GROUP BY user`).all(guild);
      return rank(rows);
    }
  };
}
