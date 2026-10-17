import Link from "next/link";
import { formatCzDate } from "@/lib/doc-tools";
import { REVIEWER } from "@/lib/site";

/**
 * S3-OPEN: řádek „Odborná revize: Helena Jeřábková, účetní“ s datem revize pod nadpisem nástroje (jako u návodů, R8.10).
 * Jen pro stránky, které účetní opravdu zkontrolovala (peněžní kalkulačky, vzor pověření).
 */
export function ReviewNote({ date }: { date: string }) {
  return (
    <p className="mt-4 text-sm text-muted">
      Odborná revize:{" "}
      <Link href={REVIEWER.path} className="underline underline-offset-2">
        {REVIEWER.name}
      </Link>
      , {REVIEWER.title} · <time dateTime={date}>{formatCzDate(date)}</time>
    </p>
  );
}
