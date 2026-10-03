import { Button } from "@/components/ui/button";

const STEPS = [
  ["01", "Upload your bill", "Snap a photo. Haggle explains it in your language."],
  ["02", "Review your case", "See what looks wrong and set the most you're willing to pay."],
  ["03", "Haggle calls, you approve", "It negotiates in English while you follow live subtitles."],
  ["04", "See your savings", "Before and after, in plain words."],
] as const;

// Website home.
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
      <section className="py-16 md:py-24">
        <h1 className="max-w-3xl text-5xl leading-[1.02] md:text-7xl">
          Speak your language. Haggle negotiates your bills in English for you.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Haggle reads your bill, calls the provider as an AI assistant, and asks for your
          approval before agreeing to anything.
        </p>
        <Button href="/demo" size="lg" className="mt-10">
          Try the demo
        </Button>
      </section>

      <section aria-labelledby="how" className="border-t border-line py-16">
        <h2
          id="how"
          className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-muted"
        >
          How it works
        </h2>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
          {STEPS.map(([n, title, body]) => (
            <li key={n} className="flex flex-col gap-3 bg-surface p-6">
              <span className="text-[11px] font-medium tracking-[0.14em] text-muted">{n}</span>
              <span className="font-display text-2xl leading-tight">{title}</span>
              <span className="text-sm leading-relaxed text-muted">{body}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
