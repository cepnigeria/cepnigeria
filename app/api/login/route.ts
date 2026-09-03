import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { ensureSchema, requireDb } from "@/lib/db";
import { randomUUID } from "node:crypto";

async function ensureInitialAdmin(){
  const password=process.env.ADMIN_INITIAL_PASSWORD;
  if(!password) return;
  const db=requireDb();
  const existing=await db`SELECT id FROM members WHERE role='super_admin' LIMIT 1`;
  if(existing.length) return;
  await db`INSERT INTO members (id,membership_number,first_name,last_name,phone,email,password_hash,category,state,lga,ward,referral_code,role,status) VALUES (${randomUUID()},'CEP-ADMIN-001','Jesufemi','Adeogun','ADMIN','adeogunjesufemi@yahoo.com',${await hashPassword(password)},'Professional','Lagos','Ikeja','Administrative',${`CEP${randomUUID().replaceAll("-","").slice(0,8).toUpperCase()}`} ,'super_admin','active') ON CONFLICT DO NOTHING`;
}

export async function POST(req:Request){
  try{
    const body=await req.json() as Record<string,string>;
    const identity=String(body.identity??"").trim().toLowerCase();
    const password=String(body.password??"");
    await ensureSchema();await ensureInitialAdmin();
    const rows=await requireDb()`SELECT id,password_hash,role,status FROM members WHERE LOWER(phone)=${identity} OR LOWER(email)=${identity} LIMIT 1`;
    const member=rows[0];
    if(!member||member.status!=="active"||!await verifyPassword(password,String(member.password_hash))) return Response.json({error:"Incorrect phone/email or password."},{status:401});
    await createSession(String(member.id));
    return Response.json({ok:true,destination:["admin","super_admin"].includes(String(member.role))?"/admin":"/portal"});
  }catch(error){
    if(error instanceof Error&&error.message==="DATABASE_NOT_CONFIGURED") return Response.json({error:"Login is being activated. Please try again shortly."},{status:503});
    console.error("login_failed",error);return Response.json({error:"Unable to sign in."},{status:500});
  }
}
