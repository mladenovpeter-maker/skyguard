import { Link } from "wouter";
import { ShieldCheck, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

/** Shown at the base path for signed-out visitors. Never auto-redirects to sign-in. */
export function AccessGate() {
  const { t } = useLanguage();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground dark px-4">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck className="h-12 w-12 text-primary" />
          <h1 className="font-mono font-bold tracking-tight text-primary uppercase text-lg">
            {t("app.name")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground font-mono uppercase tracking-wide">
          {t("access.restricted")}
        </p>
        <Link href="/sign-in">
          <Button className="gap-2 font-mono uppercase text-xs tracking-wide w-full">
            <LogIn className="w-4 h-4" />
            {t("access.signIn")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
