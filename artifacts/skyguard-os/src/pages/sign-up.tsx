import { SignUp } from "@clerk/react";
import { dark } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(190 90% 50%)",
    colorForeground: "hsl(210 20% 90%)",
    colorMutedForeground: "hsl(210 20% 60%)",
    colorDanger: "hsl(0 100% 60%)",
    colorBackground: "hsl(220 20% 8%)",
    colorInput: "hsl(220 20% 15%)",
    colorInputForeground: "hsl(210 20% 90%)",
    colorNeutral: "hsl(220 20% 15%)",
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(220_20%_8%)] border border-border rounded-lg w-[420px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-mono uppercase tracking-wide text-lg",
    headerSubtitle: "text-muted-foreground text-sm",
    socialButtonsBlockButtonText: "text-foreground text-sm font-medium",
    formFieldLabel: "text-muted-foreground text-xs uppercase tracking-wide font-mono",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    footerActionText: "text-muted-foreground text-sm",
    dividerText: "text-muted-foreground text-xs uppercase",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-primary text-xs",
    alertText: "text-destructive text-sm",
    logoBox: "flex justify-center py-2",
    logoImage: "h-14 w-14",
    socialButtonsBlockButton: "border border-border hover:bg-secondary transition-colors",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-mono uppercase tracking-wide text-sm",
    formFieldInput: "bg-input border border-border text-foreground",
    footerAction: "text-center",
    dividerLine: "bg-border",
    alert: "bg-destructive/10 border border-destructive/40",
    otpCodeFieldInput: "bg-input border border-border text-foreground",
    formFieldRow: "gap-1",
    main: "gap-4",
  },
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </div>
  );
}
