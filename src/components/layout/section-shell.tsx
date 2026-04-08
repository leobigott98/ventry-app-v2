import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SectionShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
};

export function SectionShell({ title, description, eyebrow, children }: SectionShellProps) {
  return (
    <div className="space-y-4">
      <Card className="bg-[#111827]/92">
        <CardHeader className="gap-3">
          {eyebrow ? (
            <Badge variant="outline" className="w-fit">
              {eyebrow}
            </Badge>
          ) : null}
          <div className="space-y-2">
            <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
            <CardDescription className="max-w-2xl">{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
      {children}
    </div>
  );
}
