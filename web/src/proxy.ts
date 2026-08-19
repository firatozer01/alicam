import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type CurrentUserResponse = {
  data?: { roles?: string[] };
};

type SellerWorkspaceResponse = {
  data?: { profile?: { approval_status?: string } | null };
};

const defaultSessionCookie = "alicamnet-session";

function loginRedirect(request: NextRequest) {
  const loginUrl = new URL("/giris", request.url);
  loginUrl.searchParams.set("devam", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const sessionCookie = process.env.SESSION_COOKIE_NAME ?? defaultSessionCookie;
  if (!request.cookies.has(sessionCookie)) return loginRedirect(request);

  try {
    const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8091";
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]
      ?? request.nextUrl.protocol.replace(":", "");
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]
      ?? request.headers.get("host")
      ?? request.nextUrl.host;
    const publicOrigin = `${protocol}://${host}`;
    const cookieHeader = request.cookies.getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");
    const apiHeaders = {
      Accept: "application/json",
      Cookie: cookieHeader,
      Origin: publicOrigin,
      Referer: `${publicOrigin}/`,
    };
    const response = await fetch(`${apiTarget}/api/me`, {
      cache: "no-store",
      headers: apiHeaders,
    });

    if (response.status === 401) return loginRedirect(request);
    if (!response.ok) return NextResponse.redirect(new URL("/", request.url));

    const currentUser = await response.json() as CurrentUserResponse;
    if (request.nextUrl.pathname.startsWith("/admin")
      && !currentUser.data?.roles?.includes("admin")) {
      return NextResponse.redirect(new URL("/?erisim=reddedildi", request.url));
    }

    if (request.nextUrl.pathname.startsWith("/satici-paneli")
      || request.nextUrl.pathname.startsWith("/kontor-yukle")
      || request.nextUrl.pathname.startsWith("/odeme/")) {
      if (!currentUser.data?.roles?.includes("seller")) {
        return NextResponse.redirect(new URL("/satici-ol", request.url));
      }

      const profileResponse = await fetch(`${apiTarget}/api/seller/profile`, {
        cache: "no-store",
        headers: apiHeaders,
      });
      if (profileResponse.status === 401) return loginRedirect(request);
      if (!profileResponse.ok) return NextResponse.redirect(new URL("/satici-ol", request.url));

      const workspace = await profileResponse.json() as SellerWorkspaceResponse;
      if (workspace.data?.profile?.approval_status !== "approved") {
        return NextResponse.redirect(new URL("/satici-ol", request.url));
      }
    }

    return NextResponse.next();
  } catch {
    return loginRedirect(request);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/panel/:path*", "/satici-paneli/:path*", "/kontor-yukle/:path*", "/odeme/:path*"],
};
