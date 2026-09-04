import { requireAdmin } from "@/lib/auth";
import { ensureSchema, requireDb } from "@/lib/db";
const csv = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
export async function GET(req: Request) {
  if (!(await requireAdmin()))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSchema();
  const db = requireDb();
  const params = new URL(req.url).searchParams;
  const filters = {q:String(params.get("q")??"").slice(0,100),pvc:String(params.get("pvc")??"").slice(0,40),lga:String(params.get("lga")??"").slice(0,100),lcda:String(params.get("lcda")??"").slice(0,100),ward:String(params.get("ward")??"").slice(0,100),leadership:String(params.get("leadership")??"").slice(0,120)};
  const rows = await db`SELECT DISTINCT m.membership_number,m.first_name,m.last_name,m.phone,m.email,m.category,m.state,m.lga,m.lcda,m.ward,m.full_address,m.pvc_status,m.political_affiliation,m.role,m.status,m.reward_points,m.created_at FROM members m LEFT JOIN leadership_positions lp ON lp.holder_id=m.id OR lp.deputy_holder_id=m.id WHERE (${filters.q}='' OR CONCAT_WS(' ',m.first_name,m.last_name,m.phone,m.email,m.membership_number) ILIKE ${`%${filters.q}%`}) AND (${filters.pvc}='' OR m.pvc_status=${filters.pvc}) AND (${filters.lga}='' OR m.lga=${filters.lga}) AND (${filters.lcda}='' OR COALESCE(m.lcda,'') ILIKE ${`%${filters.lcda}%`}) AND (${filters.ward}='' OR m.ward ILIKE ${`%${filters.ward}%`}) AND (${filters.leadership}='' OR m.role=${filters.leadership} OR lp.title ILIKE ${`%${filters.leadership}%`} OR (lp.deputy_holder_id=m.id AND COALESCE(lp.deputy_title,'') ILIKE ${`%${filters.leadership}%`})) ORDER BY m.created_at DESC`;
  const headers = [
    "Membership Number",
    "First Name",
    "Last Name",
    "Phone",
    "Email",
    "Category",
    "State",
    "LGA",
    "LCDA",
    "Ward",
    "Full Address",
    "PVC Status",
    "Political Affiliation",
    "Role",
    "Status",
    "Reward Points",
    "Created At",
  ];
  const keys = [
    "membership_number",
    "first_name",
    "last_name",
    "phone",
    "email",
    "category",
    "state",
    "lga",
    "lcda",
    "ward",
    "full_address",
    "pvc_status",
    "political_affiliation",
    "role",
    "status",
    "reward_points",
    "created_at",
  ];
  const body = [
    headers.map(csv).join(","),
    ...rows.map((r: any) => keys.map((k) => csv(r[k])).join(",")),
  ].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cep-members-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
