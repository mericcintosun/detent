import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { seed } from "@/lib/data";

// TEMPLATE: this page must be rewritten with the idea's real copy at scaffold
// time: hero with the product one-liner and ONE primary CTA, 2-3 product
// sections, footer. Use the shadcn primitives in components/ui; never bare
// unstyled HTML controls. No template copy may survive.
export default function Home() {
  return (
    <div className="space-y-16 py-10">
      <section className="mx-auto max-w-2xl space-y-6 text-center">
        <Badge variant="outline">TEMPLATE</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Template</h1>
        <p className="text-lg text-muted-foreground">
          Warm-start scaffold. If you can read this in a shipped product, the scaffold step failed.
        </p>
        <Button size="lg">Primary CTA</Button>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {seed.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{s.name}</CardTitle>
              <CardDescription>Replace with a real feature card.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Seed-driven content.</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
