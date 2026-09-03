"use client";
import { useRouter } from "next/navigation";
export default function LogoutButton(){const router=useRouter();return <button className="text-button" onClick={async()=>{await fetch("/api/logout",{method:"POST"});router.push("/login");router.refresh();}}>Sign out</button>}
