"use client";

import { LoaderCircle, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type LogoUploadFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
};

export function LogoUploadField({
  value,
  onChange,
  error,
  label = "Logo",
}: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/community/logo-upload", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { error?: string; publicUrl?: string };
    setIsUploading(false);

    if (!response.ok || !payload.publicUrl) {
      setUploadError(payload.error ?? "No fue posible subir la imagen.");
      event.target.value = "";
      return;
    }

    onChange(payload.publicUrl);
    event.target.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{label}</Label>
        <input
          ref={inputRef}
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          type="file"
          onChange={handleFileChange}
        />

        {value ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="relative h-32 overflow-hidden rounded-xl border border-border bg-white">
              <img
                alt="Logo de la comunidad"
                className="h-full w-full object-contain"
                src={value}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                disabled={isUploading}
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                {isUploading ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Cambiar logo
              </Button>
              <Button type="button" variant="ghost" onClick={() => onChange("")}>
                <X className="h-4 w-4" />
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <button
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-secondary/15 px-4 py-8 text-center transition hover:border-primary/40 hover:bg-secondary/25"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Upload className="h-5 w-5 text-primary" />
            )}
            <div>
              <div className="text-sm font-semibold text-foreground">
                {isUploading ? "Subiendo imagen..." : "Subir logo"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                JPG, PNG, WEBP, GIF o SVG. Maximo 5 MB.
              </div>
            </div>
          </button>
        )}
      </div>

      <FormMessage message={uploadError} variant="error" />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
