"use client";

import { useEffect } from "react";
import { cleanText } from "@/app/lib/cleanText";

const TEXT_ATTRIBUTES = ["title", "placeholder", "aria-label"];

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const oldValue = node.nodeValue ?? "";
    const newValue = cleanText(oldValue);

    if (newValue !== oldValue) {
      node.nodeValue = newValue;
    }

    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  const tag = element.tagName.toLowerCase();

  if (["script", "style", "textarea", "code", "pre"].includes(tag)) {
    return;
  }

  for (const attr of TEXT_ATTRIBUTES) {
    const oldValue = element.getAttribute(attr);

    if (oldValue) {
      const newValue = cleanText(oldValue);

      if (newValue !== oldValue) {
        element.setAttribute(attr, newValue);
      }
    }
  }

  element.childNodes.forEach(sanitizeNode);
}

export default function TextSanitizer() {
  useEffect(() => {
    let frame = 0;

    const run = () => {
      if (frame) cancelAnimationFrame(frame);

      frame = requestAnimationFrame(() => {
        sanitizeNode(document.body);
      });
    };

    run();

    const observer = new MutationObserver(run);

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: TEXT_ATTRIBUTES,
    });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
