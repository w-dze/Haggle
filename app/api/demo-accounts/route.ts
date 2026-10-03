import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ok, failMsg } from "@/lib/response";
import type { DemoPersona } from "@/lib/nessie/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "nessie_demo.json"), "utf8")) as {
      demos: DemoPersona[];
    };
    return ok({
      demos: raw.demos.map((d) => ({
        lang: d.lang,
        name: `${d.first} ${d.last}`,
        customer_id: d.customer_id,
        payee: d.payee,
        monthly: d.monthly,
      })),
    });
  } catch {
    return failMsg("no_demos", "Run npm run seed first", 404);
  }
}
