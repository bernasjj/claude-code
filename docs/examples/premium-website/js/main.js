/* main.js — comportamentos do exemplo (blueprint §3 e §10.3).
   Tudo vanilla, sem dependências. Respeita prefers-reduced-motion. */
(function () {
  "use strict";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 1. Navbar: adiciona sombra/borda ao fazer scroll */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* 2. Menu mobile */
  const toggle = document.querySelector(".nav__toggle");
  const links = document.querySelector(".nav__links");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const open = links.style.display === "flex";
      links.style.display = open ? "" : "flex";
      links.style.position = "absolute";
      links.style.flexDirection = "column";
      links.style.top = "72px";
      links.style.right = "1.25rem";
      toggle.setAttribute("aria-expanded", String(!open));
    });
  }

  /* 3. Objeto 3D do hero reage ao rato (substituível por Spline/Three.js) */
  const obj = document.querySelector(".obj3d");
  const stage = document.querySelector(".stage");
  if (obj && stage && !reduceMotion) {
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      obj.style.setProperty("--ry", `${px * 40 - 22}deg`);
      obj.style.setProperty("--rx", `${-py * 24 + 12}deg`);
    });
    stage.addEventListener("pointerleave", () => {
      obj.style.setProperty("--ry", "-22deg");
      obj.style.setProperty("--rx", "12deg");
    });
  }

  /* 4. Scroll reveal via IntersectionObserver (fallback do parallax) */
  const revealEls = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* 5. FAQ acordeão acessível */
  document.querySelectorAll(".faq__q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const panel = btn.nextElementSibling;
      btn.setAttribute("aria-expanded", String(!expanded));
      panel.style.maxHeight = expanded ? "0" : panel.scrollHeight + "px";
    });
  });

  /* 6. Formulário: validação + estados de sucesso/erro */
  const form = document.querySelector(".form");
  if (form) {
    const status = form.querySelector(".form__status");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        status.textContent = "Verifica os campos assinalados.";
        status.className = "form__status err";
        form.reportValidity();
        return;
      }
      status.textContent = "Obrigado! Entraremos em contacto em breve.";
      status.className = "form__status ok";
      form.reset();
      // PRODUÇÃO: enviar para o backend/serviço de email aqui.
    });
  }

  /* 7. Ano no footer */
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
