import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login"];

/**
 * Content-Security-Policy com nonce por requisição. O Next lê o nonce do header da requisição
 * e o aplica sozinho aos próprios scripts (exige renderização dinâmica, garantida no layout raiz).
 * `CSP_REPORT_ONLY=1` publica a política como Report-Only (implantação gradual).
 */
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  let sb = "";
  try {
    sb = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {}
  const sbWs = sb.replace(/^http/, "ws");
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${sb}`.trim(),
    `font-src 'self'`,
    `connect-src 'self' ${sb} ${sbWs}`.trim(),
    `frame-src 'self' blob: ${sb}`.trim(),
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const CSP_HEADER = process.env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

/** Renova a sessão do Supabase a cada navegação, aplica a CSP e faz o redirecionamento otimista para /login. */
export async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Copiado a cada chamada: request.cookies.set atualiza o header "cookie" de request.headers,
  // então os cookies renovados pelo Supabase chegam aos Server Components.
  const forwardHeaders = () => {
    const h = new Headers(request.headers);
    h.set("x-nonce", nonce);
    h.set(CSP_HEADER, csp);
    return h;
  };
  const withCsp = (res: NextResponse) => {
    res.headers.set(CSP_HEADER, csp);
    return res;
  };
  /** Redirect que preserva os cookies de sessão renovados nesta requisição. */
  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return withCsp(res);
  };

  let response = NextResponse.next({ request: { headers: forwardHeaders() } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: forwardHeaders() } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          if (headers) Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v as string));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!isLoggedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = path !== "/" ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    return redirectTo(url);
  }
  if (isLoggedIn && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return redirectTo(url);
  }
  return withCsp(response);
}

export const config = {
  // "\\." = ponto literal na regex (numa string JS, "\." vira só ".").
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
