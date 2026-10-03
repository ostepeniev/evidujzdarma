/**
 * Minimální parser konfigurace nginx a výběr location jako v nginx (R7.2): exact `=` → nejdelší prefix;
 * je-li to `^~`, konec; jinak první vyhovující regex (`~`, `~*`) v pořadí souboru; jinak nejdelší prefix.
 */
export interface Directive {
  name: string;
  args: string[];
  block?: Directive[];
}

function tokenize(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === "{" || c === "}" || c === ";") {
      out.push(c);
      i++;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out.push(src.slice(i + 1, j));
      i = j + 1;
    } else {
      let j = i;
      while (j < src.length && !/[\s{};]/.test(src[j]!)) j++;
      out.push(src.slice(i, j));
      i = j;
    }
  }
  return out;
}

export function parseNginx(src: string): Directive[] {
  const tokens = tokenize(src);
  let pos = 0;
  const parseBlock = (): Directive[] => {
    const list: Directive[] = [];
    while (pos < tokens.length && tokens[pos] !== "}") {
      const name = tokens[pos++]!;
      const args: string[] = [];
      while (pos < tokens.length && tokens[pos] !== ";" && tokens[pos] !== "{") args.push(tokens[pos++]!);
      if (tokens[pos] === "{") {
        pos++;
        const block = parseBlock();
        pos++; // "}"
        list.push({ name, args, block });
      } else {
        pos++; // ";"
        list.push({ name, args });
      }
    }
    return list;
  };
  return parseBlock();
}

/** Hlavní server (HTTPS, evidujzdarma.cz, bez přesměrování na úrovni serveru). */
export function mainServer(conf: Directive[]): Directive {
  const servers = conf.filter((d) => d.name === "server" && d.block);
  const s = servers.find(
    (d) =>
      d.block!.some((x) => x.name === "server_name" && x.args.includes("evidujzdarma.cz")) &&
      d.block!.some((x) => x.name === "listen" && x.args.some((a) => a.includes("443"))) &&
      !d.block!.some((x) => x.name === "return"),
  );
  if (!s) throw new Error("hlavní server evidujzdarma.cz nenalezen");
  return s;
}

export interface Location {
  modifier: "=" | "^~" | "~" | "~*" | "";
  pattern: string;
  block: Directive[];
}

export function locations(server: Directive): Location[] {
  return server.block!
    .filter((d) => d.name === "location" && d.block)
    .map((d) => {
      const [a, b] = d.args;
      const modifier = (["=", "^~", "~", "~*"].includes(a!) ? a : "") as Location["modifier"];
      return { modifier, pattern: modifier ? b! : a!, block: d.block! };
    });
}

export function matchLocation(locs: Location[], path: string): Location | null {
  const exact = locs.find((l) => l.modifier === "=" && l.pattern === path);
  if (exact) return exact;
  const prefixes = locs.filter((l) => (l.modifier === "" || l.modifier === "^~") && path.startsWith(l.pattern)).sort((x, y) => y.pattern.length - x.pattern.length);
  const longest = prefixes[0] ?? null;
  if (longest?.modifier === "^~") return longest;
  const regex = locs.find((l) => (l.modifier === "~" || l.modifier === "~*") && new RegExp(l.pattern, l.modifier === "~*" ? "i" : "").test(path));
  return regex ?? longest;
}

const directive = (block: Directive[], name: string) => block.find((d) => d.name === name);

/** Platné auth_basic pro cestu: vlastní v location, jinak serverové. `null` = žádné (veřejné). */
export function effectiveAuth(server: Directive, path: string): string | null {
  const loc = matchLocation(locations(server), path);
  const own = loc ? directive(loc.block, "auth_basic") : undefined;
  const value = own ?? directive(server.block!, "auth_basic");
  return value ? value.args[0]! : null;
}
