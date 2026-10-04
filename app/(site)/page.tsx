import { Button } from "@/components/ui/button";

const STEPS = [
  ["01", "Upload your bill", "Snap a photo. Haggle explains it in your language."],
  ["02", "Review your case", "See what looks wrong and set the most you're willing to pay."],
  ["03", "Haggle calls, you approve", "It negotiates in English while you follow live subtitles."],
  ["04", "See your savings", "Before and after, in plain words."],
] as const;

const REASONS = [
  [
    "Catch overcharges without hunting for them",
    "Haggle watches your recurring bills and tells you, in your language, when something changes: a price that jumped, a charge that came twice, a free trial that quietly became a subscription.",
  ],
  [
    "Skip the phone call in English",
    "Haggle calls the provider for you and says it is an AI assistant. You follow the whole conversation with live subtitles in your language.",
  ],
  [
    "Stay in control of every decision",
    "You set the most you are willing to pay. Haggle won't agree to anything above it, or to a new contract, without asking you first.",
  ],
  [
    "Understand your bills, not just pay them",
    "Every change is explained in plain words with the English underneath, so you learn the terms as you go. It tells you what changed and what you can ask. It never gives legal or financial advice.",
  ],
] as const;

const LANGUAGES = [
  ["es", "Español"],
  ["zh", "中文"],
  ["ko", "한국어"],
  ["en", "English"],
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

      <section aria-labelledby="why" className="border-t border-line py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:gap-16">
          <div>
            <h2
              id="why"
              className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-muted"
            >
              Why Haggle
            </h2>
            <p className="mt-6 font-display text-4xl leading-[1.05] md:text-5xl">
              Getting a fair price shouldn&rsquo;t depend on how comfortable you are on the
              phone in English.
            </p>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              Prices creep up quietly, promotions end without warning, and fixing it usually
              means a long call in English. If you are new to the country, or English isn&rsquo;t
              your first language, that call is easy to put off, and the extra charges keep
              coming every month.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Haggle does the noticing, the explaining and the calling, in the language you
              think in.
            </p>
          </div>

          <ul className="grid gap-px self-start overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
            {REASONS.map(([title, body], i) => (
              <li key={title} className="flex flex-col gap-3 bg-surface p-6">
                <span className="text-[11px] font-medium tracking-[0.14em] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-2xl leading-tight">{title}</span>
                <span className="text-sm leading-relaxed text-muted">{body}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <p className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
              Speaks
            </span>
            {LANGUAGES.map(([code, label]) => (
              <span
                key={code}
                lang={code}
                className="rounded-full border border-line bg-surface px-3 py-1 text-sm"
              >
                {label}
              </span>
            ))}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Haggle reads only what it needs from your bills: amounts, dates and provider names.
            It never follows instructions found inside an email, and it only calls numbers from
            its own verified list.
          </p>
        </div>
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
