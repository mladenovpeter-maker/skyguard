import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDevices,
  useCreateDevice,
  useRevokeDevice,
  getListDevicesQueryKey,
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { bg, enUS } from "date-fns/locale";
import { Cpu, Plus, Trash2, Copy, Check, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

export default function Admin() {
  const { t, language } = useLanguage();
  const dateLocale = language === "bg" ? bg : enUS;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: devices = [], isLoading } = useListDevices();
  const createDevice = useCreateDevice();
  const revokeDevice = useRevokeDevice();

  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState<{ name: string; apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const formSchema = z.object({
    name: z.string().min(1, t("admin.device.nameRequired")),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const created = await createDevice.mutateAsync({ data: values });
      await queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
      setAddOpen(false);
      form.reset();
      setNewKey({ name: created.name, apiKey: created.apiKey });
    } catch {
      toast({
        title: t("admin.toast.errorTitle"),
        description: t("admin.toast.createErrorDesc"),
        variant: "destructive",
      });
    }
  }

  async function onRevoke(deviceId: number) {
    try {
      await revokeDevice.mutateAsync({ deviceId });
      await queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
      toast({ title: t("admin.toast.revokedTitle") });
    } catch {
      toast({
        title: t("admin.toast.errorTitle"),
        description: t("admin.toast.revokeErrorDesc"),
        variant: "destructive",
      });
    }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-3">
            <Cpu className="w-6 h-6" />
            {t("admin.title")}
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-2 uppercase">{t("admin.subtitle")}</p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-mono uppercase text-xs tracking-wide">
              <Plus className="w-4 h-4" />
              {t("admin.addDevice")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.dialog.title")}</DialogTitle>
              <DialogDescription>{t("admin.dialog.description")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.device.name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("admin.device.namePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createDevice.isPending} className="font-mono uppercase text-xs tracking-wide">
                    {createDevice.isPending ? t("admin.dialog.creating") : t("admin.dialog.create")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div className="grid grid-cols-5 gap-4 p-4 border-b border-border bg-muted/50 font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">{t("admin.table.device")}</div>
          <div>{t("admin.table.status")}</div>
          <div>{t("admin.table.lastSeen")}</div>
          <div className="text-right">{t("admin.table.actions")}</div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground font-mono text-sm uppercase">
            <Cpu className="w-8 h-8 opacity-20" />
            {t("admin.empty")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {devices.map((device) => (
              <div key={device.id} className="grid grid-cols-5 gap-4 p-4 items-center">
                <div className="col-span-2">
                  <div className="font-mono text-sm font-medium text-foreground">{device.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{device.apiKeyPrefix}…</div>
                </div>
                <div>
                  {device.revoked ? (
                    <Badge variant="destructive" className="font-mono text-xs uppercase">
                      {t("admin.status.revoked")}
                    </Badge>
                  ) : (
                    <Badge className="font-mono text-xs uppercase bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
                      {t("admin.status.active")}
                    </Badge>
                  )}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {device.lastSeenAt
                    ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true, locale: dateLocale })
                    : t("admin.neverConnected")}
                </div>
                <div className="text-right">
                  {!device.revoked && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("admin.revokeDialog.title")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("admin.revokeDialog.description", { name: device.name })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("admin.revokeDialog.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRevoke(device.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("admin.revokeDialog.confirm")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={newKey != null} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              {t("admin.keyDialog.title")}
            </DialogTitle>
            <DialogDescription>{t("admin.keyDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 bg-muted p-3 rounded-md border border-border">
            <code className="flex-1 font-mono text-sm text-foreground break-all">{newKey?.apiKey}</code>
            <Button variant="outline" size="icon" onClick={copyKey}>
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("admin.keyDialog.warning")}</p>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)} className="font-mono uppercase text-xs tracking-wide">
              {t("admin.keyDialog.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
