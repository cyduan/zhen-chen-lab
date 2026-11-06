const normalize = value => value.normalize("NFKC").trim().toLowerCase();

function appendReleaseText(parent, tag, value, className = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function renderPublishedResources(container, releases) {
  if (!container || !Array.isArray(releases)) return;
  const categories = {"方法": "method", "代码与数据": "research", "工具导览": "guide", "研究导览": "guide"};

  for (const release of releases) {
    if (typeof release?.title !== "string" || !release.title.trim()) continue;
    if (typeof release.public_id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(release.public_id)) continue;

    const card = document.createElement("article");
    card.className = "entry";
    card.dataset.entry = "";
    card.dataset.type = categories[release.kind] || "";
    card.id = "shared-" + release.public_id;

    const date = typeof release.published_at === "string" ? release.published_at.slice(0, 10) : "";
    const metadata = [release.kind, date]
      .filter(value => typeof value === "string" && value.trim())
      .join(" · ");
    if (metadata) appendReleaseText(card, "p", metadata, "entry-meta");
    const title = appendReleaseText(card, "h3", "");
    const open = appendReleaseText(title, "a", release.title, "resource-open");
    open.href = "resources.html?read=" + card.id;
    if (typeof release.summary === "string" && release.summary.trim()) {
      appendReleaseText(card, "p", release.summary);
    }
    const cue = appendReleaseText(card, "span", "阅读全文 →", "resource-read-cue");
    cue.setAttribute("aria-hidden", "true");
    const body = appendReleaseText(card, "div", "", "resource-prose");
    body.dataset.resourceBody = "";
    body.hidden = true;
    if (typeof release.body === "string" && release.body.trim()) {
      const template = document.createElement("template");
      template.dataset.resourceMarkdown = "";
      template.content.append(release.body);
      body.append(template);
    }
    if (typeof release.source_url === "string" && release.source_url.trim()) {
      try {
        const url = new URL(release.source_url);
        if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) {
          const links = appendReleaseText(body, "p", "", "entry-links");
          const source = appendReleaseText(links, "a", "查看来源 ↗");
          source.href = url.href;
        }
      } catch {
        // A malformed source URL leaves the resource readable without a link.
      }
    }
    container.append(card);
  }

  container.closest("section").hidden = container.childElementCount === 0;
}

renderPublishedResources(document.getElementById("published-resources"), window.LAB_PUBLISHED_RESOURCES);

function showResourceReader() {
  const reader = document.getElementById("resource-reader");
  const parameters = new URLSearchParams(location.search);
  if (!reader || !parameters.has("read")) return;

  const directory = document.getElementById("resource-directory");
  directory.hidden = true;
  reader.hidden = false;
  const back = new URL("resources.html", location.href);
  for (const key of ["q", "type"]) {
    if (parameters.get(key)) back.searchParams.set(key, parameters.get(key));
  }
  const card = document.getElementById(parameters.get("read"));
  const backLink = document.getElementById("resource-back");
  if (!card?.matches("#resource-directory [data-entry]")) {
    backLink.href = back.href;
    document.getElementById("resource-missing").hidden = false;
    return;
  }
  back.hash = card.id;
  backLink.href = back.href;
  const article = document.getElementById("resource-article");
  const meta = card.querySelector(":scope > .entry-meta");
  const summary = card.querySelector(":scope > p:not(.entry-meta)");
  if (meta) article.append(meta);
  const title = card.querySelector(".resource-open").textContent;
  appendReleaseText(article, "h1", title, "resource-title");
  if (summary) {
    summary.classList.add("resource-summary");
    article.append(summary);
  }
  const body = card.querySelector("[data-resource-body]");
  for (const template of body.querySelectorAll("template[data-resource-markdown]")) {
    const prose = document.createElement("div");
    window.KnowledgeMarkdown.render(prose, template.content.textContent);
    template.replaceWith(prose);
  }
  body.hidden = false;
  article.append(body);
  document.title = title + " · 知识分享 · 陈振课题组";
}

showResourceReader();

for (const catalog of document.querySelectorAll("[data-catalog]")) {
  if (catalog.closest("[hidden]")) continue;
  const form = catalog.querySelector("[data-filter]");
  const count = catalog.querySelector("[data-count]");
  const controls = Array.from(form.querySelectorAll("input[name], select[name]"));
  const entries = Array.from(catalog.querySelectorAll("[data-entry]"), element => {
    const markdown = Array.from(element.querySelectorAll("template[data-resource-markdown]"),
      template => template.content.textContent).join(" ");
    return {
      element,
      open: element.querySelector(".resource-open"),
      text: normalize([element.textContent, element.dataset.keywords, markdown].join(" ")),
    };
  });
  const groups = catalog.querySelectorAll("[data-group]");

  function filter(updateUrl = false) {
    const values = new URLSearchParams(controls.map(control => [control.name, control.value.trim()]));
    const terms = normalize(values.get("q") || "").split(/\s+/).filter(Boolean);
    const categories = Array.from(values).filter(([name, value]) => name !== "q" && value);
    let visible = 0;
    for (const {element, open, text} of entries) {
      const matches = terms.every(term => text.includes(term))
        && categories.every(([name, value]) => name === "topic"
          ? (element.dataset.topic || "").split(" ").includes(value)
          : element.dataset[name] === value);
      element.classList.toggle("filter-in", matches && element.hidden);
      element.hidden = !matches;
      if (open && matches) {
        const target = new URL("resources.html", location.href);
        target.searchParams.set("read", element.id);
        for (const key of ["q", "type"]) {
          if (values.get(key)) target.searchParams.set(key, values.get(key));
        }
        open.href = target.href;
      }
      visible += Number(matches);
    }
    for (const group of groups) group.hidden = !group.querySelector("[data-entry]:not([hidden])");
    count.textContent = visible ? "显示 " + visible + " 条，共 " + entries.length + " 条"
      : "没有匹配的结果。可调整关键词或清除筛选。";

    if (updateUrl) {
      for (const control of controls) {
        if (!values.get(control.name)) values.delete(control.name);
      }
      const url = new URL(location.href);
      url.search = values.toString();
      history.replaceState(null, "", url);
    }
  }

  function readUrl() {
    const values = new URLSearchParams(location.search);
    for (const control of controls) control.value = values.get(control.name) || "";
    filter();
  }

  readUrl();
  form.hidden = false;
  if (location.search && !location.hash) catalog.scrollIntoView({behavior: "instant"});
  addEventListener("popstate", readUrl);
  form.addEventListener("input", () => filter(true));
  form.addEventListener("submit", event => {
    event.preventDefault();
    filter(true);
  });
  form.addEventListener("reset", event => {
    event.preventDefault();
    for (const control of controls) control.value = "";
    filter(true);
  });
}

async function copyCommand(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Local files and permission settings may require the selection fallback.
  }

  if (typeof document.execCommand !== "function") return false;

  const focused = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.append(field);
  try {
    field.focus({preventScroll: true});
    field.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    if (focused instanceof HTMLElement) focused.focus({preventScroll: true});
  }
}

for (const sample of document.querySelectorAll(".code-sample")) {
  const button = sample.querySelector(".code-copy");
  const code = sample.querySelector("pre code");
  const status = sample.querySelector(".code-copy-status");
  if (!button || !code || !status) continue;

  let copying = false;
  let resetFeedback;
  button.hidden = false;
  button.addEventListener("click", async () => {
    if (copying) return;
    copying = true;
    clearTimeout(resetFeedback);
    status.textContent = "";

    const copied = await copyCommand(code.textContent);
    button.textContent = copied ? "已复制" : "复制失败";
    status.textContent = copied ? "已复制命令。" : "复制失败，请选中命令手动复制。";
    copying = false;
    resetFeedback = setTimeout(() => {
      button.textContent = "复制";
      status.textContent = "";
    }, 3000);
  });
}

if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const reveal = new IntersectionObserver((items, observer) => {
    for (const item of items) {
      if (!item.isIntersecting) continue;
      item.target.classList.add("is-revealed");
      observer.unobserve(item.target);
    }
  }, { threshold: .12 });
  for (const target of document.querySelectorAll("[data-reveal]")) reveal.observe(target);
}
