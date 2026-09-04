import { randomUUID } from "node:crypto";
import { createSession, hashPassword } from "@/lib/auth";
import { ensureSchema, requireDb } from "@/lib/db";

const categories = new Set([
  "Studentpreneur",
  "Student Professional",
  "Professional",
  "Entrepreneur",
  "Corporate Member",
  "Fellow",
  "Patron",
  "Honorary Member",
]);
const clean = (value: unknown, max = 120) =>
  String(value ?? "")
    .trim()
    .slice(0, max);

export async function POST(req: Request) {
  try {
    const p = (await req.json()) as Record<string, unknown>;
    const firstName = clean(p.firstName, 60),
      lastName = clean(p.lastName, 60),
      phone = clean(p.phone, 30),
      email = clean(p.email, 150).toLowerCase();
    const password = String(p.password ?? ""),
      category = clean(p.category),
      lga = clean(p.lga),
      ward = clean(p.ward),
      referral = clean(p.referralCode, 30).toUpperCase();
    if (!firstName || !lastName || !phone || !category || !lga || !ward)
      return Response.json(
        { error: "Please complete every required field." },
        { status: 400 },
      );
    if (!categories.has(category))
      return Response.json(
        { error: "Please select a valid membership category." },
        { status: 400 },
      );
    if (password.length < 8)
      return Response.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    await ensureSchema();
    const db = requireDb();
    const referrer = referral
      ? await db`SELECT id FROM members WHERE referral_code=${referral} LIMIT 1`
      : [];
    const id = randomUUID(),
      membershipNumber = `CEP-${new Date().getFullYear()}-${Math.random().toString().slice(2, 8)}`;
    const referralCode = `CEP${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    await db.begin(async (tx) => {
      await tx`INSERT INTO members (id,membership_number,first_name,last_name,phone,email,password_hash,category,state,lga,lcda,ward,full_address,pvc_status,political_affiliation,referral_code,referred_by) VALUES (${id},${membershipNumber},${firstName},${lastName},${phone},${email || null},${await hashPassword(password)},${category},'Lagos',${lga},${clean(p.lcda) || null},${ward},${clean(p.fullAddress, 500)},${clean(p.pvcStatus) || "Prefer not to disclose"},${clean(p.politicalAffiliation) || "Prefer not to disclose"},${referralCode},${referrer[0]?.id ?? null})`;
      if (referrer[0])
        await tx`UPDATE members SET reward_points=reward_points+10 WHERE id=${referrer[0].id}`;
    });
    await createSession(id);
    return Response.json({ ok: true, membershipNumber }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("members_phone_key"))
      return Response.json(
        { error: "This phone number is already registered." },
        { status: 409 },
      );
    if (message.includes("members_email_key"))
      return Response.json(
        { error: "This email address is already registered." },
        { status: 409 },
      );
    if (message === "DATABASE_NOT_CONFIGURED")
      return Response.json(
        { error: "Registration is being activated. Please try again shortly." },
        { status: 503 },
      );
    console.error("registration_failed", error);
    return Response.json(
      { error: "Registration could not be completed." },
      { status: 500 },
    );
  }
}
