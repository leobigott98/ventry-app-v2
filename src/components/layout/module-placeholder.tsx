import { ArrowRight, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  nextSprintFocus: string[];
  quickWins: string[];
};

export function ModulePlaceholder({
  title,
  description,
  nextSprintFocus,
  quickWins,
}: ModulePlaceholderProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="border-white/70 bg-white/90">
        <CardHeader>
          <Badge variant="warning" className="w-fit">
            Scaffold Sprint 0
          </Badge>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {quickWins.map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/35 p-4"
            >
              <ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm leading-6 text-foreground">{item}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/70 bg-white/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-primary" />
            Siguiente foco
          </CardTitle>
          <CardDescription>Continuidad recomendada para Sprint 1.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextSprintFocus.map((item, index) => (
            <div
              key={item}
              className="rounded-2xl border border-border bg-white p-4 text-sm leading-6 text-muted-foreground"
            >
              <span className="mr-2 font-semibold text-foreground">0{index + 1}.</span>
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
