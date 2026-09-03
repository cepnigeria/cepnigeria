"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm(){
  const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState("");
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const data=Object.fromEntries(new FormData(e.currentTarget));const r=await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const body=await r.json();if(r.ok){router.push(body.destination);router.refresh();}else{setError(body.error);setBusy(false);}}
  return <form onSubmit={submit}><div className="field-grid"><div className="field full"><label htmlFor="identity">Phone number or email</label><input id="identity" name="identity" required autoComplete="username"/></div><div className="field full"><label htmlFor="password">Password</label><input id="password" name="password" required type="password" autoComplete="current-password"/></div></div>{error?<p className="error-message" role="alert">{error}</p>:null}<div className="form-actions"><button className="button" disabled={busy}>{busy?"Signing in…":"Sign in"}</button></div></form>;
}
