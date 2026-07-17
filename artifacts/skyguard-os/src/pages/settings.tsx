import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetHomeConfig, useUpdateHomeConfig, getGetHomeConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Settings as SettingsIcon, Save, MapPin, Shield, Map as MapIcon, Radio, Plus, Trash2, Eye, EyeOff } from "lucide-react";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { LocationPicker } from "@/components/settings/LocationPicker";

// ---- Known RF bands (mirrors frequencies.json) ----
const RF_BANDS = [
  { id: "rc_433",   label: "RC 433 MHz",        color: "#f59e0b" },
  { id: "rc_868",   label: "RC 868 MHz",         color: "#f59e0b" },
  { id: "rc_915",   label: "RC 915 MHz",         color: "#f59e0b" },
  { id: "dji_2400", label: "DJI / FPV 2.4 GHz", color: "#ef4444" },
  { id: "dji_5150", label: "DJI O3 5.1 GHz",    color: "#ef4444" },
  { id: "dji_5800", label: "DJI O3 / FPV 5.8 GHz", color: "#ef4444" },
];

interface KnownRfSource { id: number; bandId: string; label: string; suppress: boolean; }

function useKnownRfSources() {
  return useQuery<KnownRfSource[]>({
    queryKey: ["known-rf-sources"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/known-rf-sources`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
  });
}

function KnownRfSourcesSection() {
  const { data: sources = [], refetch } = useKnownRfSources();
  const { toast } = useToast();
  const [addingBand, setAddingBand] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");

  const suppressed = new Set(sources.filter(s => s.suppress).map(s => s.bandId));
  const existing   = new Set(sources.map(s => s.bandId));
  const available  = RF_BANDS.filter(b => !existing.has(b.id));

  async function addSource(bandId: string, label: string) {
    await fetch(`${import.meta.env.BASE_URL}api/known-rf-sources`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bandId, label, suppress: true }),
    });
    refetch();
    setAddingBand(null);
    setLabelInput("");
    toast({ title: "Запазено", description: `${label} добавен като ваш` });
  }

  async function toggleSuppress(source: KnownRfSource) {
    await fetch(`${import.meta.env.BASE_URL}api/known-rf-sources`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bandId: source.bandId, label: source.label, suppress: !source.suppress }),
    });
    refetch();
  }

  async function removeSource(bandId: string) {
    await fetch(`${import.meta.env.BASE_URL}api/known-rf-sources/${bandId}`, {
      method: "DELETE", credentials: "include",
    });
    refetch();
    toast({ title: "Премахнато" });
  }

  return (
    <div className="space-y-4 pt-4">
      <h3 className="text-lg font-mono font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
        <Radio className="w-4 h-4 text-primary" /> Наши RF устройства
      </h3>
      <p className="text-xs text-muted-foreground font-mono">
        Маркирай честотни bands принадлежащи на твоите устройства (рутер, RC контролер...). Bridge-ът ще ги пропуска при засичане.
      </p>

      {/* Existing entries */}
      <div className="space-y-2">
        {sources.length === 0 && (
          <div className="text-xs text-muted-foreground font-mono py-2 border border-dashed border-border rounded px-3">
            Няма добавени устройства
          </div>
        )}
        {sources.map(src => {
          const band = RF_BANDS.find(b => b.id === src.bandId);
          return (
            <div key={src.id} className="flex items-center gap-3 p-2.5 rounded border border-border bg-background/50">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: band?.color ?? "#888" }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-bold truncate">{src.label}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{band?.label ?? src.bandId}</div>
              </div>
              <button
                onClick={() => toggleSuppress(src)}
                className={`text-[10px] font-mono px-2 py-1 rounded border ${src.suppress ? "border-green-500/40 text-green-400 bg-green-500/10" : "border-border text-muted-foreground"}`}
                title={src.suppress ? "Потисна алерти (кликни за включване)" : "Алертите активни (кликни за потискане)"}
              >
                {src.suppress ? <><EyeOff className="w-3 h-3 inline mr-1" />ИГНОРИРАН</> : <><Eye className="w-3 h-3 inline mr-1" />АКТИВЕН</>}
              </button>
              <button onClick={() => removeSource(src.bandId)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add new */}
      {addingBand ? (
        <div className="flex items-center gap-2 p-3 rounded border border-primary/30 bg-primary/5">
          <div className="flex-1">
            <div className="text-xs font-mono text-muted-foreground mb-1">
              {RF_BANDS.find(b => b.id === addingBand)?.label}
            </div>
            <Input
              placeholder="Например: Домашен WiFi рутер"
              value={labelInput}
              onChange={e => setLabelInput(e.target.value)}
              className="font-mono text-xs h-8 bg-background"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter" && labelInput.trim()) addSource(addingBand, labelInput.trim()); }}
            />
          </div>
          <Button size="sm" onClick={() => addSource(addingBand, labelInput.trim())} disabled={!labelInput.trim()} className="font-mono text-xs">
            <Save className="w-3 h-3 mr-1" /> Запази
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAddingBand(null); setLabelInput(""); }} className="font-mono text-xs">
            Отказ
          </Button>
        </div>
      ) : available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map(b => (
            <button
              key={b.id}
              onClick={() => setAddingBand(b.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-dashed border-border text-[10px] font-mono text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Plus className="w-3 h-3" />
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
              {b.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground font-mono">Всички bands са добавени.</div>
      )}
    </div>
  );
}

export default function Settings() {
  const { data: config, isLoading } = useGetHomeConfig();
  const updateConfig = useUpdateHomeConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  const formSchema = z.object({
    propertyName: z.string().min(1, t("settings.field.designationRequired")),
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    geofenceRadiusMeters: z.coerce.number().min(1, t("settings.field.radiusMin")),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyName: "",
      lat: 0,
      lng: 0,
      geofenceRadiusMeters: 500,
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        propertyName: config.propertyName,
        lat: config.lat,
        lng: config.lng,
        geofenceRadiusMeters: config.geofenceRadiusMeters,
      });
    }
  }, [config, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateConfig.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetHomeConfigQueryKey(), data);
          toast({
            title: t("settings.toast.savedTitle"),
            description: t("settings.toast.savedDesc"),
          });
        },
        onError: () => {
          toast({
            title: t("settings.toast.errorTitle"),
            description: t("settings.toast.errorDesc"),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col p-6 max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-3">
          <SettingsIcon className="w-6 h-6" />
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2 uppercase">
          {t("settings.subtitle")}
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm p-6">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="space-y-4">
                <h3 className="text-lg font-mono font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> {t("settings.section.propertyDetails")}
                </h3>
                
                <FormField
                  control={form.control}
                  name="propertyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase">{t("settings.field.designation")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("settings.field.designationPlaceholder")} className="font-mono bg-background" {...field} />
                      </FormControl>
                      <FormDescription className="font-mono text-xs">
                        {t("settings.field.designationDesc")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-mono font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-primary" /> {t("settings.section.positioning")}
                </h3>
                
                <LocationPicker
                  lat={form.watch("lat")}
                  lng={form.watch("lng")}
                  onChange={(lat, lng) => {
                    form.setValue("lat", lat, { shouldDirty: true, shouldValidate: true });
                    form.setValue("lng", lng, { shouldDirty: true, shouldValidate: true });
                  }}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono uppercase flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" /> {t("settings.field.latitude")}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="any" className="font-mono bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lng"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono uppercase flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" /> {t("settings.field.longitude")}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="any" className="font-mono bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-mono font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> {t("settings.section.perimeter")}
                </h3>
                
                <FormField
                  control={form.control}
                  name="geofenceRadiusMeters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase">{t("settings.field.radius")}</FormLabel>
                      <FormControl>
                        <Input type="number" className="font-mono bg-background" {...field} />
                      </FormControl>
                      <FormDescription className="font-mono text-xs">
                        {t("settings.field.radiusDesc")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <KnownRfSourcesSection />

              <div className="pt-6 border-t border-border flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateConfig.isPending}
                  className="font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {updateConfig.isPending ? t("settings.button.committing") : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {t("settings.button.commit")}
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
