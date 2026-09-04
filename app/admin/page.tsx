import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { ensureSchema, getSettings, requireDb } from "@/lib/db";
import LogoutButton from "@/components/LogoutButton";
export const dynamic = "force-dynamic";

const text = (v: FormDataEntryValue | null, max = 5000) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
const categories = [
  "Studentpreneur",
  "Student Professional",
  "Professional",
  "Entrepreneur",
  "Corporate Member",
  "Fellow",
  "Patron",
  "Honorary Member",
];
const publicRoles = ["member", "coordinator", "executive"];
async function adminGuard() {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  return admin;
}
async function saveSettings(data: FormData) {
  "use server";
  await adminGuard();
  await ensureSchema();
  const db = requireDb();
  for (const key of [
    "description",
    "mission",
    "vision",
    "address",
    "phone",
    "general_whatsapp",
  ]) {
    const value = text(data.get(key));
    if (value)
      await db`INSERT INTO settings(key,value,updated_at)VALUES(${key},${value},NOW()) ON CONFLICT(key)DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
  }
  revalidatePath("/admin");
  revalidatePath("/");
}
async function addGroup(data: FormData) {
  "use server";
  await adminGuard();
  await ensureSchema();
  const name = text(data.get("name"), 120),
    url = text(data.get("invite_url"), 500),
    audience = text(data.get("audience"), 120) || "general";
  if (name && url.startsWith("https://chat.whatsapp.com/"))
    await requireDb()`INSERT INTO whatsapp_groups(id,name,invite_url,audience)VALUES(${randomUUID()},${name},${url},${audience})`;
  revalidatePath("/admin");
  revalidatePath("/portal");
}
async function addUnit(data: FormData) {
  "use server";
  await adminGuard();
  await ensureSchema();
  const name = text(data.get("name"), 120),
    type = text(data.get("type"), 30),
    parent = text(data.get("parent_id"), 60);
  if (name && ["state", "lga", "lcda", "ward"].includes(type))
    await requireDb()`INSERT INTO organization_units(id,name,type,parent_id)VALUES(${randomUUID()},${name},${type},${parent || null}) ON CONFLICT DO NOTHING`;
  revalidatePath("/admin");
}
async function addPosition(data: FormData) {
  "use server";
  await adminGuard();
  await ensureSchema();
  const title = text(data.get("title"), 120),
    department = text(data.get("department"), 120),
    level = text(data.get("level"), 50) || "national",
    deputy = text(data.get("deputy_title"), 120);
  if (title)
    await requireDb()`INSERT INTO leadership_positions(id,title,department,level,deputy_title)VALUES(${randomUUID()},${title},${department || null},${level},${deputy || null})`;
  revalidatePath("/admin");
}
async function updateMember(data: FormData) {
  "use server";
  const admin = await adminGuard();
  await ensureSchema();
  const id = text(data.get("id"), 60),
    role = text(data.get("role"), 30),
    status = text(data.get("status"), 30);
  if (
    id === String(admin.id) &&
    (role !== String(admin.role) || status !== "active")
  )
    return;
  const permitted =
    String(admin.role) === "super_admin"
      ? ["member", "coordinator", "executive", "admin", "super_admin"]
      : ["member", "coordinator", "executive"];
  if (permitted.includes(role) && ["active", "suspended"].includes(status))
    await requireDb()`UPDATE members SET role=${role},status=${status},updated_at=NOW()WHERE id=${id} AND (role!='super_admin' OR ${String(admin.role)}='super_admin')`;
  revalidatePath("/admin");
}
async function createMember(data: FormData) {
  "use server";
  const admin = await adminGuard();
  await ensureSchema();
  const first = text(data.get("first_name"), 60),
    last = text(data.get("last_name"), 60),
    phone = text(data.get("phone"), 30),
    email = text(data.get("email"), 150).toLowerCase(),
    password = String(data.get("password") ?? ""),
    category = text(data.get("category"), 80),
    lga = text(data.get("lga"), 100),
    ward = text(data.get("ward"), 100),
    role = text(data.get("role"), 30) || "member";
  const permitted =
    String(admin.role) === "super_admin"
      ? [...publicRoles, "admin", "super_admin"]
      : publicRoles;
  if (
    !first ||
    !last ||
    !phone ||
    password.length < 8 ||
    !categories.includes(category) ||
    !lga ||
    !ward ||
    !permitted.includes(role)
  )
    return;
  const id = randomUUID(),
    number = `CEP-${new Date().getFullYear()}-${Math.random().toString().slice(2, 8)}`,
    code = `CEP${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  await requireDb()`INSERT INTO members(id,membership_number,first_name,last_name,phone,email,password_hash,category,state,lga,lcda,ward,full_address,pvc_status,political_affiliation,referral_code,role,status)VALUES(${id},${number},${first},${last},${phone},${email || null},${await hashPassword(password)},${category},'Lagos',${lga},${text(data.get("lcda"), 100) || null},${ward},${text(data.get("full_address"), 500)},${text(data.get("pvc_status"), 40) || "Prefer not to disclose"},${text(data.get("political_affiliation"), 80) || "Prefer not to disclose"},${code},${role},'active')`;
  revalidatePath("/admin");
}
async function editMember(data: FormData) {
  "use server";
  const admin = await adminGuard();
  await ensureSchema();
  const id = text(data.get("id"), 60),
    role = text(data.get("role"), 30),
    status = text(data.get("status"), 30),
    permitted =
      String(admin.role) === "super_admin"
        ? [...publicRoles, "admin", "super_admin"]
        : publicRoles;
  if (
    !id ||
    !permitted.includes(role) ||
    !["active", "suspended"].includes(status)
  )
    return;
  const current =
    await requireDb()`SELECT role FROM members WHERE id=${id} LIMIT 1`;
  if (
    !current[0] ||
    (String(current[0].role) === "super_admin" &&
      String(admin.role) !== "super_admin") ||
    (id === String(admin.id) &&
      (role !== String(admin.role) || status !== "active"))
  )
    return;
  const password = String(data.get("password") ?? "");
  const values = {
    first: text(data.get("first_name"), 60),
    last: text(data.get("last_name"), 60),
    phone: text(data.get("phone"), 30),
    email: text(data.get("email"), 150).toLowerCase(),
    category: text(data.get("category"), 80),
    lga: text(data.get("lga"), 100),
    lcda: text(data.get("lcda"), 100),
    ward: text(data.get("ward"), 100),
    address: text(data.get("full_address"), 500),
    pvc: text(data.get("pvc_status"), 40),
    politics: text(data.get("political_affiliation"), 80),
  };
  if (
    !values.first ||
    !values.last ||
    !values.phone ||
    !categories.includes(values.category) ||
    !values.lga ||
    !values.ward
  )
    return;
  const db = requireDb();
  if (password) {
    if (password.length < 8) return;
    await db`UPDATE members SET first_name=${values.first},last_name=${values.last},phone=${values.phone},email=${values.email || null},category=${values.category},lga=${values.lga},lcda=${values.lcda || null},ward=${values.ward},full_address=${values.address},pvc_status=${values.pvc},political_affiliation=${values.politics},role=${role},status=${status},password_hash=${await hashPassword(password)},updated_at=NOW()WHERE id=${id}`;
  } else
    await db`UPDATE members SET first_name=${values.first},last_name=${values.last},phone=${values.phone},email=${values.email || null},category=${values.category},lga=${values.lga},lcda=${values.lcda || null},ward=${values.ward},full_address=${values.address},pvc_status=${values.pvc},political_affiliation=${values.politics},role=${role},status=${status},updated_at=NOW()WHERE id=${id}`;
  revalidatePath("/admin");
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  await ensureSchema();
  const db = requireDb();
  const requested = await searchParams;
  const filters = {
    q: String(requested.q ?? "")
      .trim()
      .slice(0, 100),
    pvc: String(requested.pvc ?? "").slice(0, 40),
    lga: String(requested.lga ?? "").slice(0, 100),
    lcda: String(requested.lcda ?? "").slice(0, 100),
    ward: String(requested.ward ?? "").slice(0, 100),
    leadership: String(requested.leadership ?? "").slice(0, 120),
  };
  const pattern = `%${filters.q}%`;
  const leadershipPattern = `%${filters.leadership}%`;
  const membersQuery = db`SELECT DISTINCT m.id,m.membership_number,m.first_name,m.last_name,m.phone,m.email,m.category,m.lga,m.lcda,m.ward,m.full_address,m.pvc_status,m.political_affiliation,m.role,m.status,m.created_at FROM members m LEFT JOIN leadership_positions lp ON lp.holder_id=m.id OR lp.deputy_holder_id=m.id WHERE (${filters.q}='' OR CONCAT_WS(' ',m.first_name,m.last_name,m.phone,m.email,m.membership_number) ILIKE ${pattern}) AND (${filters.pvc}='' OR m.pvc_status=${filters.pvc}) AND (${filters.lga}='' OR m.lga=${filters.lga}) AND (${filters.lcda}='' OR COALESCE(m.lcda,'') ILIKE ${`%${filters.lcda}%`}) AND (${filters.ward}='' OR m.ward ILIKE ${`%${filters.ward}%`}) AND (${filters.leadership}='' OR m.role=${filters.leadership} OR lp.title ILIKE ${leadershipPattern} OR (lp.deputy_holder_id=m.id AND COALESCE(lp.deputy_title,'') ILIKE ${leadershipPattern})) ORDER BY m.created_at DESC LIMIT 200`;
  const [settings, members, units, groups, positions, stats] =
    await Promise.all([
      getSettings(),
      membersQuery,
      db`SELECT u.id,u.name,u.type,p.name parent_name FROM organization_units u LEFT JOIN organization_units p ON p.id=u.parent_id ORDER BY u.type,u.name`,
      db`SELECT id,name,invite_url,audience,active FROM whatsapp_groups ORDER BY name`,
      db`SELECT id,title,department,level,deputy_title,active FROM leadership_positions ORDER BY level,title`,
      db`SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE role IN('admin','super_admin'))::int admins,COUNT(*)FILTER(WHERE created_at>NOW()-INTERVAL '30 days')::int new_members FROM members`,
    ]);
  const s = stats[0];
  const activeFilters = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value),
  );
  const filterQuery = new URLSearchParams(activeFilters).toString();
  return (
    <main className="portal">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <img src="/cep-logo.jpeg" alt="CEP" />
          <b>
            CEP <small>ADMIN</small>
          </b>
        </Link>
        <nav className="side-nav">
          <a href="#dashboard" className="active">
            Dashboard
          </a>
          <a href="#members">Members</a>
          <a href="#structure">Structure</a>
          <a href="#leadership">Leadership</a>
          <a href="#groups">WhatsApp groups</a>
          <a href="#content">Website content</a>
        </nav>
      </aside>
      <section className="workspace">
        <div className="workspace-head">
          <div>
            <p className="eyebrow">SECURE ADMINISTRATION</p>
            <h1>CEP control centre</h1>
            <p>
              Signed in as {String(admin.first_name)} {String(admin.last_name)}
            </p>
          </div>
          <LogoutButton />
        </div>
        <div className="stat-grid" id="dashboard">
          {[
            ["Total members", String(s.total)],
            ["New this month", String(s.new_members)],
            ["Administrators", String(s.admins)],
            ["Structure units", String(units.length)],
          ].map((x) => (
            <article className="stat" key={x[0]}>
              <small>{x[0]}</small>
              <strong>{x[1]}</strong>
            </article>
          ))}
        </div>
        <article className="panel wide" id="create-member">
          <h2>Create a member account</h2>
          <p className="form-note">
            Create an account, assign its role and send the member their
            phone/email and temporary password privately.
          </p>
          <form action={createMember} className="admin-create-grid">
            <input name="first_name" placeholder="First name" required />
            <input name="last_name" placeholder="Last name" required />
            <input name="phone" placeholder="Phone number" required />
            <input name="email" type="email" placeholder="Email address" />
            <input
              name="password"
              type="password"
              minLength={8}
              placeholder="Temporary password (8+ characters)"
              required
            />
            <select name="category" required defaultValue="">
              <option value="" disabled>
                Membership category
              </option>
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input name="lga" placeholder="LGA" required />
            <input name="lcda" placeholder="LCDA (if applicable)" />
            <input name="ward" placeholder="Ward" required />
            <textarea
              className="full"
              name="full_address"
              rows={2}
              placeholder="Full residential/contact address"
              required
            />
            <select name="pvc_status">
              <option>Prefer not to disclose</option>
              <option>Yes</option>
              <option>No</option>
              <option>In process</option>
            </select>
            <select name="political_affiliation">
              <option>Prefer not to disclose</option>
              <option>APC</option>
              <option>Other</option>
              <option>None</option>
            </select>
            <select name="role">
              {(String(admin.role) === "super_admin"
                ? [...publicRoles, "admin", "super_admin"]
                : publicRoles
              ).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <button className="button small">Create member</button>
          </form>
        </article>
        <article className="panel wide" id="members">
          <div className="panel-title">
            <h2>Members</h2>
            <a
              className="button small"
              href={`/api/admin/members/export${filterQuery ? `?${filterQuery}` : ""}`}
            >
              Download results
            </a>
          </div>
          <form method="get" action="/admin" className="search-form">
            <label>
              Member search
              <input
                name="q"
                defaultValue={filters.q}
                placeholder="Name, phone, email or number"
              />
            </label>
            <label>
              PVC status
              <select name="pvc" defaultValue={filters.pvc}>
                <option value="">All</option>
                <option>Yes</option>
                <option>No</option>
                <option>In process</option>
                <option>Prefer not to disclose</option>
              </select>
            </label>
            <label>
              LGA
              <input
                name="lga"
                defaultValue={filters.lga}
                placeholder="All LGAs"
              />
            </label>
            <label>
              LCDA
              <input
                name="lcda"
                defaultValue={filters.lcda}
                placeholder="All LCDAs"
              />
            </label>
            <label>
              Ward
              <input
                name="ward"
                defaultValue={filters.ward}
                placeholder="All wards"
              />
            </label>
            <label>
              Role/leadership
              <select name="leadership" defaultValue={filters.leadership}>
                <option value="">All</option>
                {[
                  ...publicRoles,
                  "admin",
                  "super_admin",
                  ...positions.map((p: any) => String(p.title)),
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <button className="button small">Search</button>
            {filterQuery ? (
              <Link href="/admin#members">Clear filters</Link>
            ) : null}
          </form>
          <p className="form-note">
            Showing {members.length} matching member
            {members.length === 1 ? "" : "s"}.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Role & status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={String(m.id)}>
                    <td>
                      <strong>
                        {String(m.first_name)} {String(m.last_name)}
                      </strong>
                      <br />
                      <small>
                        {String(m.membership_number)} · {String(m.phone)}
                      </small>
                      <details className="member-editor">
                        <summary>Edit full account</summary>
                        <form action={editMember} className="stack-form">
                          <input type="hidden" name="id" value={String(m.id)} />
                          <input
                            name="first_name"
                            defaultValue={String(m.first_name)}
                            aria-label="First name"
                            required
                          />
                          <input
                            name="last_name"
                            defaultValue={String(m.last_name)}
                            aria-label="Last name"
                            required
                          />
                          <input
                            name="phone"
                            defaultValue={String(m.phone)}
                            aria-label="Phone"
                            required
                          />
                          <input
                            name="email"
                            type="email"
                            defaultValue={String(m.email ?? "")}
                            aria-label="Email"
                          />
                          <select
                            name="category"
                            defaultValue={String(m.category)}
                            aria-label="Category"
                          >
                            {categories.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                          <input
                            name="lga"
                            defaultValue={String(m.lga)}
                            aria-label="LGA"
                            required
                          />
                          <input
                            name="lcda"
                            defaultValue={String(m.lcda ?? "")}
                            aria-label="LCDA"
                          />
                          <input
                            name="ward"
                            defaultValue={String(m.ward)}
                            aria-label="Ward"
                            required
                          />
                          <textarea
                            name="full_address"
                            defaultValue={String(m.full_address ?? "")}
                            aria-label="Full address"
                            rows={3}
                            required
                          />
                          <select
                            name="pvc_status"
                            defaultValue={String(m.pvc_status)}
                            aria-label="PVC status"
                          >
                            <option>Prefer not to disclose</option>
                            <option>Yes</option>
                            <option>No</option>
                            <option>In process</option>
                          </select>
                          <select
                            name="political_affiliation"
                            defaultValue={String(m.political_affiliation)}
                            aria-label="Political affiliation"
                          >
                            <option>Prefer not to disclose</option>
                            <option>APC</option>
                            <option>Other</option>
                            <option>None</option>
                          </select>
                          <select
                            name="role"
                            defaultValue={String(m.role)}
                            aria-label="Role"
                          >
                            {[
                              ...new Set([
                                ...(String(admin.role) === "super_admin"
                                  ? [...publicRoles, "admin", "super_admin"]
                                  : publicRoles),
                                String(m.role),
                              ]),
                            ].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                          <select
                            name="status"
                            defaultValue={String(m.status)}
                            aria-label="Status"
                          >
                            <option>active</option>
                            <option>suspended</option>
                          </select>
                          <input
                            name="password"
                            type="password"
                            minLength={8}
                            placeholder="New password (leave blank to keep current)"
                            aria-label="New password"
                          />
                          <button className="button small">
                            Save all changes
                          </button>
                        </form>
                      </details>
                    </td>
                    <td>{String(m.category)}</td>
                    <td>
                      {String(m.lga)}
                      <br />
                      <small>{String(m.ward)}</small>
                    </td>
                    <td>
                      <form action={updateMember} className="inline-form">
                        <input type="hidden" name="id" value={String(m.id)} />
                        <select
                          name="role"
                          defaultValue={String(m.role)}
                          disabled={
                            String(m.role) === "super_admin" &&
                            String(admin.role) !== "super_admin"
                          }
                        >
                          {(String(admin.role) === "super_admin"
                            ? [
                                "member",
                                "coordinator",
                                "executive",
                                "admin",
                                "super_admin",
                              ]
                            : ["member", "coordinator", "executive"]
                          ).map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                        <select
                          name="status"
                          defaultValue={String(m.status)}
                          disabled={
                            String(m.role) === "super_admin" &&
                            String(admin.role) !== "super_admin"
                          }
                        >
                          <option>active</option>
                          <option>suspended</option>
                        </select>
                        <button
                          disabled={
                            String(m.role) === "super_admin" &&
                            String(admin.role) !== "super_admin"
                          }
                        >
                          Save
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <div className="panel-grid">
          <article className="panel" id="structure">
            <h2>Lagos structure</h2>
            <form action={addUnit} className="stack-form">
              <input name="name" placeholder="Unit name" required />
              <select name="type">
                <option>state</option>
                <option>lga</option>
                <option>lcda</option>
                <option>ward</option>
              </select>
              <select name="parent_id" defaultValue="">
                <option value="">No parent</option>
                {units.map((u: any) => (
                  <option key={String(u.id)} value={String(u.id)}>
                    {String(u.type)} · {String(u.name)}
                  </option>
                ))}
              </select>
              <button className="button small">Add unit</button>
            </form>
            <div className="quick-list compact">
              {units.slice(0, 30).map((u: any) => (
                <div className="quick-item" key={String(u.id)}>
                  <span>{String(u.name)}</span>
                  <span className="tag">{String(u.type)}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel" id="leadership">
            <h2>Leadership & departments</h2>
            <form action={addPosition} className="stack-form">
              <input name="title" placeholder="Position title" required />
              <input name="department" placeholder="Department" />
              <input
                name="deputy_title"
                placeholder="Deputy or assistant title"
              />
              <select name="level">
                <option>national</option>
                <option>state</option>
                <option>lga</option>
                <option>lcda</option>
                <option>ward</option>
              </select>
              <button className="button small">Add position</button>
            </form>
            {positions.map((p: any) => (
              <div className="quick-item" key={String(p.id)}>
                <span>
                  {String(p.title)}
                  <small>
                    {p.department ? ` · ${String(p.department)}` : ""}
                  </small>
                </span>
                <span className="tag">{String(p.level)}</span>
              </div>
            ))}
          </article>
        </div>
        <div className="panel-grid">
          <article className="panel" id="groups">
            <h2>WhatsApp groups</h2>
            <form action={addGroup} className="stack-form">
              <input name="name" placeholder="Group name" required />
              <input
                name="invite_url"
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                required
              />
              <input name="audience" placeholder="general, LGA or ward" />
              <button className="button small">Add group</button>
            </form>
            {groups.map((g: any) => (
              <div className="quick-item" key={String(g.id)}>
                <a href={String(g.invite_url)} target="_blank" rel="noreferrer">
                  {String(g.name)}
                </a>
                <span className="tag">{String(g.audience)}</span>
              </div>
            ))}
          </article>
          <article className="panel" id="content">
            <h2>Editable website content</h2>
            <form action={saveSettings} className="stack-form">
              <label>
                Description
                <textarea
                  name="description"
                  defaultValue={settings.description}
                />
              </label>
              <label>
                Mission
                <textarea name="mission" defaultValue={settings.mission} />
              </label>
              <label>
                Vision
                <textarea name="vision" defaultValue={settings.vision} />
              </label>
              <label>
                Address
                <input name="address" defaultValue={settings.address} />
              </label>
              <label>
                Phone
                <input name="phone" defaultValue={settings.phone} />
              </label>
              <label>
                General WhatsApp
                <input
                  name="general_whatsapp"
                  defaultValue={settings.general_whatsapp}
                />
              </label>
              <button className="button small">Save website content</button>
            </form>
          </article>
        </div>
      </section>
    </main>
  );
}
