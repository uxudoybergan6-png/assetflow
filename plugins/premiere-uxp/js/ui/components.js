/*
 * FrameFlow UXP — UI primitivlari.
 *
 * innerHTML ISHLATILMAYDI (XSS + UXP parser cheklovlari) — hamma element
 * createElement bilan quriladi. Layout FAQAT flexbox + margin (spike §3).
 */
(function () {
  "use strict";

  /** el("div", {class:"x", onClick:fn}, [bola|matn]) */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = String(v);
      else if (k === "style") node.setAttribute("style", v);
      else if (k === "onClick") node.addEventListener("click", v);
      else if (k === "onInput") node.addEventListener("input", v);
      else if (k === "onKeyDown") node.addEventListener("keydown", v);
      else if (k === "disabled") node.disabled = !!v;
      else node.setAttribute(k, String(v));
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  /**
   * Tugma — ATAYLAB `<div role="button">`, `<button>` EMAS.
   * Sabab (Premiere 26.2 da o'lchandi): UXP `<button>` ni native widget qilib
   * chizadi va `background-color`/`color` e'tiborsiz qoladi (border/radius esa
   * qo'llanadi) — primary tugma lime emas, kulrang chiqadi. div bilan brend
   * ranglari to'liq boshqariladi; klaviatura (Tab + Enter/Space) qo'lda beriladi.
   */
  function button(label, opts) {
    var o = opts || {};
    var disabled = !!o.disabled;
    var cls = "ff-btn" + (o.variant ? " ff-btn-" + o.variant : "") + (disabled ? " ff-btn-disabled" : "");
    var b = el("div", {
      class: cls,
      role: "button",
      tabindex: disabled ? "-1" : "0",
      "aria-disabled": disabled ? "true" : "false",
      title: o.title || (disabled && o.disabledReason) || label,
      "aria-label": o.ariaLabel || label,
      text: label,
    });
    if (!disabled && o.onClick) {
      b.addEventListener("click", o.onClick);
      b.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          o.onClick(e);
        }
      });
    }
    return b;
  }

  function field(labelText, inputAttrs) {
    var input = el("input", inputAttrs || {});
    input.className = "ff-input";
    var wrap = el("div", { class: "ff-field" }, [
      el("label", { class: "ff-label", text: labelText }),
      input,
    ]);
    return { wrap: wrap, input: input };
  }

  function note(text, kind) {
    return el("div", { class: "ff-note" + (kind ? " ff-note-" + kind : ""), text: text });
  }

  /** Halol "ishlamaydi" holati: qisqa sabab + (bo'lsa) keyingi qadam. */
  function unavailable(title, reason, actionLabel, onAction) {
    var kids = [
      el("div", { class: "ff-h2", text: title }),
      el("div", { class: "ff-muted", text: reason }),
    ];
    if (actionLabel && onAction) {
      kids.push(el("div", { style: "margin-top:12px;" }, [
        button(actionLabel, { onClick: onAction }),
      ]));
    }
    return el("div", { class: "ff-card" }, kids);
  }

  function spinnerText(text) {
    return el("div", { class: "ff-muted", style: "padding:16px;text-align:center;", text: text || "Yuklanmoqda…" });
  }

  var toastTimer = null;
  function toast(message, kind) {
    var host = document.getElementById("ffToasts");
    if (!host) return;
    clear(host);
    host.appendChild(el("div", { class: "ff-toast" + (kind ? " ff-toast-" + kind : ""), text: message }));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { clear(host); }, kind === "error" ? 6000 : 3500);
  }

  window.FFUI = {
    el: el,
    clear: clear,
    button: button,
    field: field,
    note: note,
    unavailable: unavailable,
    spinnerText: spinnerText,
    toast: toast,
  };
})();
