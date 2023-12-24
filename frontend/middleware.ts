import { NextRequest, NextResponse } from "next/server";
import { isJwtExpired } from 'jwt-check-expiration';
import checkAuth from "./checktoken";

const checkVerification = async (token:string | undefined) => {
    try {      
      const res = await fetch("http://localhost:8000/auth/CheckFirstLogin", {
        method: 'GET',
        credentials: 'include',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
      },
      });
      console.log("status", res.status);
      if (res.status === 401) {
        console.log("fuck");
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
    const res = await fetch("http://localhost:8000/auth/refresh", {
      method: 'GET',
      credentials: 'include',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshtoken}`
    },
    });
    console.log("status", res.status);
    const result = res.json()
    if (res.status === 200) {
      console.log("llllllllllllllllllllllllllllllllllllll");
      return result;
    }
    if (res.status === 401){
      console.log("unauthorized")
      return  result;
    }
    else{
      return result;
    }
  } catch (error) {
      console.error("Error during authentication check:", error);
      return ;
  }
}

export default async function middleware(request: NextRequest){
    let token  = request.cookies.get("token")?.value;
    const refreshtoken  = request.cookies.get("refresh");
    const IsExpired = isJwtExpired(token);
    // let response: NextResponse = new NextResponse;
    // if (IsExpired){
    //   const refresh = await refreshToken(refreshtoken?.value as string);
    //   token  = refresh;
    //   response.cookies.set("token", token as string);
    //   console.log("token new response: ", token);
    // }
    const succes = await checkAuth(token);
    let isFirstTime = await checkVerification(token);
    if (request.nextUrl.pathname === '/settings')
        isFirstTime = false;

    if (succes && !isFirstTime){
      console.log('here')
      return NextResponse.next();
    }
    if (isFirstTime)
      return NextResponse.redirect(new URL("http://localhost:3000/settings"));
    return NextResponse.redirect(new URL("/", "http://localhost:3000/"));
}

export const config = {
    matcher: ['/Dashboard', '/settings', '/profile/:path*', '/Chat', '/Leaderboard']
}