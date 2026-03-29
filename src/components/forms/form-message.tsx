import { cn } from "@/lib/utils";

type FormMessageProps = {
  message?: string | null;
  variant?: "success" | "error";
};

export function FormMessage({ message, variant = "success" }: FormMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        variant === "success"
          ? "border-success/20 bg-success/10 text-success"
          : "border-danger/20 bg-danger/10 text-danger",
      )}
    >
      {message}
    </div>
  );
}

