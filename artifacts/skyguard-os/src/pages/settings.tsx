import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetHomeConfig, useUpdateHomeConfig, getGetHomeConfigQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Save, MapPin, Shield, Map as MapIcon } from "lucide-react";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  propertyName: z.string().min(1, "Property name is required"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  geofenceRadiusMeters: z.coerce.number().min(1, "Radius must be at least 1 meter"),
});

export default function Settings() {
  const { data: config, isLoading } = useGetHomeConfig();
  const updateConfig = useUpdateHomeConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
            title: "Configuration Saved",
            description: "Property and geofence settings updated successfully.",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to save configuration. Please try again.",
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
          System Configuration
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2 uppercase">
          Configure property coordinates and perimeter defense radius
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
                  <Shield className="w-4 h-4 text-primary" /> Property Details
                </h3>
                
                <FormField
                  control={form.control}
                  name="propertyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase">Designation</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. ALPHA BASE" className="font-mono bg-background" {...field} />
                      </FormControl>
                      <FormDescription className="font-mono text-xs">
                        Internal reference name for this installation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-mono font-bold text-foreground border-b border-border pb-2 flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-primary" /> Global Positioning
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono uppercase flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" /> Latitude
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
                          <MapPin className="w-3 h-3 text-muted-foreground" /> Longitude
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
                  <Shield className="w-4 h-4 text-primary" /> Perimeter Defense
                </h3>
                
                <FormField
                  control={form.control}
                  name="geofenceRadiusMeters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase">Alarm Radius (Meters)</FormLabel>
                      <FormControl>
                        <Input type="number" className="font-mono bg-background" {...field} />
                      </FormControl>
                      <FormDescription className="font-mono text-xs">
                        Proximity threshold for triggering audible and visual alarms.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-6 border-t border-border flex justify-end">
                <Button 
                  type="submit" 
                  disabled={updateConfig.isPending}
                  className="font-mono uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {updateConfig.isPending ? "Committing..." : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Commit Changes
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
