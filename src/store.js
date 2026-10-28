import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
const directory = process.env.DATA_DIR || './data';
mkdirSync(directory, {recursive:true});
export const db = new DatabaseSync(join(directory, 'tavreniq.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS warnings (id INTEGER PRIMARY KEY, guild TEXT, member TEXT, moderator TEXT, reason TEXT, created TEXT);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, guild TEXT, moderator TEXT, action TEXT, target TEXT, reason TEXT, created TEXT);`);
export function warn(guild, member, moderator, reason) {
  return db.prepare('INSERT INTO warnings(guild,member,moderator,reason,created) VALUES(?,?,?,?,?)').run(guild,member,moderator,reason,new Date().toISOString()).lastInsertRowid;
}
export function warnings(guild,member) {
  return db.prepare('SELECT * FROM warnings WHERE guild=? AND member=? ORDER BY id DESC LIMIT 10').all(guild,member);
}
export function log(guild,moderator,action,target,reason) {
  db.prepare('INSERT INTO audit(guild,moderator,action,target,reason,created) VALUES(?,?,?,?,?,?)').run(guild,moderator,action,target,reason,new Date().toISOString());
}
export function close(){db.close();}

