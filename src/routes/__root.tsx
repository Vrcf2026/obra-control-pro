import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          Voltar
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Decoverdi — Gestão de Obras" },
      { name: "description", content: "Decoverdi, S.A. — Gestão de custos de obras." },
      { name: "theme-color", content: "#1a5fa8" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Decoverdi Obras" },
      { property: "og:title", content: "Decoverdi — Gestão de Obras" },
      { property: "og:description", content: "Decoverdi, S.A. — Gestão de custos de obras." },
      { name: "twitter:title", content: "Decoverdi — Gestão de Obras" },
      { name: "twitter:description", content: "Decoverdi, S.A. — Gestão de custos de obras." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/83f644a8-d4b0-42d3-8421-b3e2b9f2b0d7/id-preview-8657f4fa--bb45f4a6-f51c-4961-b079-5c4a3e5fa37e.lovable.app-1778151557711.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/83f644a8-d4b0-42d3-8421-b3e2b9f2b0d7/id-preview-8657f4fa--bb45f4a6-f51c-4961-b079-5c4a3e5fa37e.lovable.app-1778151557711.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Não registar dentro de iframes (preview Lovable) nem em hosts de preview
    let inIframe = false;
    try { inIframe = window.self !== window.top; } catch { inIframe = true; }
    const host = window.location.hostname;
    const isPreview = host.includes("id-preview--") || host.includes("lovableproject.com");
    if (inIframe || isPreview) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <AuthProvider>
      <Outlet />
      <Toaster />
    </AuthProvider>
  );
}
