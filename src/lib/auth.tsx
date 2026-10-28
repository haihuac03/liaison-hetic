"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
export interface AuthUser { id:string; name:string; email:string; role:"owner"|"tenant" }
export interface AuthProperty { id:string; address:string; owner_id:string; tenant_id:string|null; owner_name:string; tenant_name:string|null }
export interface AuthInvitation { code:string; property_id:string; expires:number; used_at:number|null }
interface AuthState { user:AuthUser|null; properties:AuthProperty[]; invitations:AuthInvitation[] }
export async function coreRequest<T = Record<string, unknown>>(action:string, body?:unknown):Promise<T> {
  const response = await fetch(`/api/core/${action}`, { method:body === undefined ? "GET":"POST", credentials:"same-origin", cache:"no-store", ...(body === undefined ? {} : {headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Une erreur est survenue. Réessayez.");
  return data;
}
const AuthContext=createContext<(AuthState & {loading:boolean; error:string; refresh:()=>Promise<void>; logout:()=>Promise<void>})|null>(null);
export function AuthProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState<AuthState>({user:null,properties:[],invitations:[]});
  const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const refresh=useCallback(async()=> {
    setError("");
    try { const response=await fetch("/api/core/state",{credentials:"same-origin",cache:"no-store"});
      if(response.status===401) {setState({user:null,properties:[],invitations:[]});return;}
      if(!response.ok) throw new Error("Impossible de charger votre session.");
      const data=await response.json();setState({user:data.user,properties:data.properties||[],invitations:data.invitations||[]});
    } catch(e) {setError(e instanceof Error ? e.message:"Connexion indisponible.");} finally {setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const logout=async()=>{await coreRequest("logout",{});setState({user:null,properties:[],invitations:[]});window.location.href="/auth";};
  return <AuthContext.Provider value={{...state,loading,error,refresh,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("AuthProvider requis");return value;}
