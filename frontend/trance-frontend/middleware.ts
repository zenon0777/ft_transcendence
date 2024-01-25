import { NextRequest, NextResponse } from "next/server";
import checkAuth from "./checktoken";
import axios from "axios";
import { toast } from "react-toastify";

const checkVerification = async (token:string | undefined) => {
    try {      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_HOST}/auth/CheckFirstLogin`, {
        method: 'GET',
        credentials: 'include',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
      },
      });
      if (res.status === 401) {
        // console.log("fuck");
        return true;
      }
      if (res.status === 200){
        const isfirst = await res.json();
        return (isfirst.FirstLogin === false) ? false : true;
      }
      else{
        return true;
      }
    } catch (error) {
        console.error("Error during authentication check:", error);
        return true;
    }
}

const refreshToken = async (refreshtoken : string) => {
  try {      
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_HOST}/auth/refresh`, {
      method: 'GET',
      credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshtoken}`
    },
    });
    // console.log("status", res.status);
    const result = res.json()
    if (res.status === 200) {
      return result;
    }
    if (res.status === 401){
      // console.log("unauthorized")
      return result;
    }
    else{
      return result;
    }
  } catch (error) {
    console.error("Error during authentication check:", error);
    return ;
  }
}

const firstLoginAchiv = async (token : string | undefined) => {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_HOST}/user/FirstLogin`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
        // console.log("success");
    }
    } catch (error) {
    console.error("Error during check:", error);
}
}

export default async function middleware(request: NextRequest){
    let token = request.cookies.get("token")?.value;
    const refreshtoken  = request.cookies.get("refresh");
    // console.log('token in middleware is === ', token)
    const succes = await checkAuth(token);
    // let isFirstTime = await checkVerification(token);
    // if (isFirstTime){
    //   await firstLoginAchiv(token);
    // }
    // console.log('success == ', succes);
    if (succes){
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", `${process.env.NEXT_PUBLIC_FRONTEND_HOST}/`));
}
 
export const config = {
  matcher: ['/Dashboard', '/settings', '/profile/:path*', '/Chat', '/Leaderboard', '/game/:path*']
}