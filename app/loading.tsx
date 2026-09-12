import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * The register is read on the server, so this stands in while it arrives. Same
 * rhythm as the console, same tokens, no spinner: ruled blocks on the ground
 * colour, the way the page will look once the rows land.
 */
export default function Loading() {
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <p className="detent-label">Reading the register</p>
        <div className="h-12 w-full max-w-[16ch] border-b border-border bg-card sm:h-14" />
        <div className="space-y-3">
          <div className="h-4 w-full max-w-[52ch] bg-card" />
          <div className="h-4 w-full max-w-[44ch] bg-card" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-32 border border-border bg-card" />
          <div className="h-6 w-40 border border-border bg-card" />
        </div>
      </section>

      <Card>
        <CardHeader className="border-b border-border">
          <p className="detent-label">Plan</p>
          <div className="h-7 w-full max-w-[28ch] bg-secondary" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b border-border px-6 py-3">
            <div className="h-3 w-full max-w-[40ch] bg-secondary" />
          </div>
          <ul className="divide-y divide-border">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <li
                key={row}
                className="grid gap-4 px-6 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div className="h-4 w-full max-w-[24ch] bg-secondary" />
                <div className="h-4 w-full max-w-[14ch] bg-secondary" />
                <div className="h-4 w-full max-w-[10ch] bg-secondary" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
