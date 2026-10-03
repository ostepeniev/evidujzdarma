import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Viditelný text stránky: bez značek, s dekódovanými entitami a sloučenými mezerami (pro doslovné texty z recenzí). */
export function pageText(Page: FC): string {
  return renderToStaticMarkup(createElement(Page))
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ");
}
