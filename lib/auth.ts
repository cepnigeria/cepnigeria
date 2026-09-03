import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ensureSchema, requireDb } from "./db";

const scrypt = promisify(scryptCallback);
const COOKIE = "cep_session";

export async function hashPassword(password:string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password:string, stored:string) {
  const [salt,hex] = stored.split(":");
  if (!salt || !hex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex,"hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const tokenHash = (token:string) => createHash("sha256").update(token).digest("hex");

export async function createSession(memberId:string) {
  await ensureSchema();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now()+1000*60*60*24*14);
  await requireDb()`INSERT INTO sessions (id,member_id,token_hash,expires_at) VALUES (${randomUUID()},${memberId},${tokenHash(token)},${expires})`;
  const jar = await cookies();
  jar.set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires});
}

export async function destroySession() {
  const jar=await cookies();
  const token=jar.get(COOKIE)?.value;
  if(token && process.env.DATABASE_URL){await ensureSchema();await requireDb()`DELETE FROM sessions WHERE token_hash=${tokenHash(token)}`;}
  jar.delete(COOKIE);
}

export async function currentMember() {
  if(!process.env.DATABASE_URL) return null;
  const token=(await cookies()).get(COOKIE)?.value;
  if(!token) return null;
  await ensureSchema();
  const rows=await requireDb()`SELECT m.id,m.membership_number,m.first_name,m.last_name,m.phone,m.email,m.category,m.state,m.lga,m.lcda,m.ward,m.profession,m.business_name,m.bio,m.referral_code,m.reward_points,m.role,m.status,m.created_at FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>NOW() LIMIT 1`;
  return rows[0] ?? null;
}

export async function requireAdmin() {
  const member=await currentMember();
  if(!member || !["admin","super_admin"].includes(String(member.role))) return null;
  return member;
}
