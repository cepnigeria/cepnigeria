export async function POST(req:Request){
  const p=await req.json() as Record<string,string>;
  for(const k of["firstName","lastName","phone","password","category","state","lga","ward"]){
    if(!p[k]?.trim()) return Response.json({error:k+" is required"},{status:400});
  }
  if(p.password.length<8) return Response.json({error:"Password must be at least 8 characters."},{status:400});
  return Response.json(
    {error:"Registration storage is being connected. No information was submitted or saved."},
    {status:503}
  );
}
