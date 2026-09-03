import postgres from "postgres";
import { randomUUID } from "node:crypto";

const connectionString = process.env.DATABASE_URL;
export const sql = connectionString ? postgres(connectionString, { ssl: "require", max: 5 }) : null;
export const defaultSettings:Record<string,string>={organization_name:"Coalition of Entrepreneurs and Professionals (CEP)",description:"A community for ambitious entrepreneurs and professionals ready to scale their ventures, access opportunities and build valuable strategic relationships.",mission:"To connect, equip and promote entrepreneurs and professionals through strategic relationships, shared intelligence and access to opportunities that strengthen enterprise, careers and communities.",vision:"To become Nigeria’s most trusted coalition for enterprise growth, professional advancement and collaborative impact.",address:"3 Awolowo Way, Ikeja, Lagos",phone:"+234 814 832 8738",general_whatsapp:"https://chat.whatsapp.com/KO2hT8zs0nA3WJqFVeSec3?s=cl&p=i&mlu=0&ilr=0"};

let schemaReady: Promise<void> | null = null;

export function requireDb() {
  if (!sql) throw new Error("DATABASE_NOT_CONFIGURED");
  return sql;
}

export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const db = requireDb();
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS members (
        id UUID PRIMARY KEY,
        membership_number TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        category TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'Lagos',
        lga TEXT NOT NULL,
        lcda TEXT,
        ward TEXT NOT NULL,
        pvc_status TEXT NOT NULL DEFAULT 'Prefer not to disclose',
        political_affiliation TEXT NOT NULL DEFAULT 'Prefer not to disclose',
        profession TEXT,
        business_name TEXT,
        bio TEXT,
        referral_code TEXT UNIQUE NOT NULL,
        referred_by UUID REFERENCES members(id) ON DELETE SET NULL,
        reward_points INTEGER NOT NULL DEFAULT 0,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY,
        member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS organization_units (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parent_id UUID REFERENCES organization_units(id) ON DELETE CASCADE,
        coordinator_id UUID REFERENCES members(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE(name, type, parent_id)
      );
      CREATE TABLE IF NOT EXISTS leadership_positions (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        department TEXT,
        level TEXT NOT NULL DEFAULT 'national',
        reports_to UUID REFERENCES leadership_positions(id) ON DELETE SET NULL,
        holder_id UUID REFERENCES members(id) ON DELETE SET NULL,
        deputy_title TEXT,
        deputy_holder_id UUID REFERENCES members(id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );
      CREATE TABLE IF NOT EXISTS whatsapp_groups (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        invite_url TEXT NOT NULL,
        audience TEXT NOT NULL DEFAULT 'general',
        unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS members_location_idx ON members(state,lga,ward);
      CREATE INDEX IF NOT EXISTS members_referrer_idx ON members(referred_by);
      CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
    `);

    for (const [key,value] of Object.entries(defaultSettings)) {
      await db`INSERT INTO settings (key,value) VALUES (${key},${value}) ON CONFLICT (key) DO NOTHING`;
    }
    const stateId="00000000-0000-4000-8000-000000000001";
    await db`INSERT INTO organization_units(id,name,type,sort_order)VALUES(${stateId},'Lagos','state',0)ON CONFLICT DO NOTHING`;
    const lgas=["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"];
    for(const [index,name]of lgas.entries())await db`INSERT INTO organization_units(id,name,type,parent_id,sort_order)VALUES(${randomUUID()},${name},'lga',${stateId},${index+1})ON CONFLICT DO NOTHING`;
    const positionCount=await db`SELECT COUNT(*)::int count FROM leadership_positions`;
    if(Number(positionCount[0]?.count)===0){for(const [title,department,level,deputy]of [["President",null,"national","Deputy President"],["Director General","Operations","national","Deputy Director General"],["Secretary General","Secretariat","national","Assistant Secretary General"],["Director","Membership & Mobilisation","state","Deputy Director"],["Director","Entrepreneurship & Professional Development","state","Deputy Director"],["Director","Media & Communications","state","Deputy Director"],["Director","Political Affairs & Civic Engagement","state","Deputy Director"],["Director","Partnerships & Corporate Relations","state","Deputy Director"],["Director","Technology & Data","state","Deputy Director"]])await db`INSERT INTO leadership_positions(id,title,department,level,deputy_title)VALUES(${randomUUID()},${title},${department},${level},${deputy})`;}
  })().catch((error) => { schemaReady = null; throw error; });
  return schemaReady;
}

export async function getSettings() {
  if(!sql)return defaultSettings;
  await ensureSchema();
  const rows = await requireDb()`SELECT key,value FROM settings`;
  return {...defaultSettings,...Object.fromEntries(rows.map((row) => [String(row.key), String(row.value)]))};
}
