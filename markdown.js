(() => {
  "use strict";

  function add(parent, tag, text) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    parent.append(element);
    return element;
  }

  function renderLink(parent, token) {
    let url;
    if (/^https?:\/\//i.test(token.href)) {
      try { url = new URL(token.href); } catch { /* Use the label as text below. */ }
    }
    if (url && !url.username && !url.password) {
      const anchor = add(parent, "a");
      anchor.href = url.href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      renderTokens(anchor, token.tokens);
    } else {
      renderTokens(parent, token.tokens);
    }
  }

  function renderTable(parent, token) {
    const wrapper = add(parent, "div");
    wrapper.className = "markdown-table";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Markdown 表格");
    const table = add(wrapper, "table");
    const head = add(add(table, "thead"), "tr");
    for (const cell of token.header) {
      const heading = add(head, "th");
      heading.scope = "col";
      if (cell.align) heading.style.textAlign = cell.align;
      renderTokens(heading, cell.tokens);
    }
    const body = add(table, "tbody");
    for (const cells of token.rows) {
      const row = add(body, "tr");
      for (const cell of cells) {
        const data = add(row, "td");
        if (cell.align) data.style.textAlign = cell.align;
        renderTokens(data, cell.tokens);
      }
    }
  }

  function renderTokens(parent, tokens) {
    for (const token of tokens) {
      switch (token.type) {
        case "space":
        case "def":
          break;
        case "heading":
          renderTokens(add(parent, "h" + Math.max(2, token.depth)), token.tokens);
          break;
        case "paragraph":
          renderTokens(add(parent, "p"), token.tokens);
          break;
        case "text":
          if (token.tokens) renderTokens(parent, token.tokens);
          else parent.append(token.text);
          break;
        case "escape":
          parent.append(token.text);
          break;
        case "em":
        case "strong":
        case "del":
        case "blockquote":
          renderTokens(add(parent, token.type), token.tokens);
          break;
        case "codespan":
          add(parent, "code", token.text);
          break;
        case "code": {
          const block = add(parent, "pre");
          block.tabIndex = 0;
          add(block, "code", token.text);
          break;
        }
        case "list": {
          const list = add(parent, token.ordered ? "ol" : "ul");
          if (token.ordered) list.start = token.start;
          for (const item of token.items) renderTokens(add(list, "li"), item.tokens);
          break;
        }
        case "checkbox": {
          const box = add(parent, "input");
          box.type = "checkbox";
          box.checked = token.checked;
          box.disabled = true;
          box.setAttribute("aria-label", token.checked ? "已完成" : "未完成");
          break;
        }
        case "table":
          renderTable(parent, token);
          break;
        case "link":
          renderLink(parent, token);
          break;
        case "image":
          parent.append(token.text || "图片");
          break;
        case "br":
        case "hr":
          add(parent, token.type);
          break;
        case "html":
          if (token.block) add(parent, "div", token.text).className = "markdown-literal";
          else parent.append(token.text);
          break;
        default:
          parent.append(token.raw || "");
      }
    }
  }

  window.KnowledgeMarkdown = {
    render(container, source) {
      container.classList.add("markdown-body");
      const content = document.createDocumentFragment();
      try {
        // Tokenize only. User-controlled text never goes through an HTML parser.
        renderTokens(content, window.marked.lexer(source, {gfm: true, breaks: true}));
      } catch {
        content.replaceChildren();
        add(content, "div", source).className = "markdown-literal";
      }
      container.replaceChildren(content);
    },
  };
})();
