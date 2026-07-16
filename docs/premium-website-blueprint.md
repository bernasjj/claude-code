# Premium Website Blueprint

> Manual reutilizável para construir websites "premium" (alto valor) em
> **HTML / CSS / JavaScript puro**, de forma consistente, para os clientes da
> agência.
>
> **Como usar:** este é o padrão de referência. Em qualquer projeto novo de
> website de cliente, segue este documento do início ao fim e valida com a
> [checklist de entrega](#9-checklist-de-entrega).

---

## 0. Filosofia

Um website "premium" não é uma questão de efeitos: é a soma de **clareza da
mensagem**, **hierarquia visual forte**, **detalhe de acabamento** e
**performance**. Antes de escrever código, responde a três perguntas:

1. **Quem** é o público e qual a **única** ação que queremos que faça (o CTA)?
2. Qual é a **proposta de valor** numa frase?
3. Que **prova** (resultados, testemunhos, logos) sustenta essa promessa?

Tudo o que não serve estas respostas é ruído — corta.

---

## 1. Princípios de design

- **Hierarquia visual:** uma coisa dominante por secção. Título > subtítulo >
  corpo > apoio. O olhar deve ter um percurso óbvio.
- **Whitespace generoso:** o espaço em branco é o que faz um site parecer caro.
  Não encham as secções; deem-lhes ar (respiração vertical de 80–120px entre
  secções em desktop).
- **Tipografia (escala modular):** 1–2 famílias, máximo. Usa uma escala
  consistente (ex.: 1.25 — *major third*):

  | Token        | rem   | Uso                     |
  |--------------|-------|-------------------------|
  | `--fs-xs`    | 0.8   | legendas, labels        |
  | `--fs-sm`    | 0.9   | apoio                   |
  | `--fs-base`  | 1.0   | corpo                   |
  | `--fs-lg`    | 1.25  | destaque de corpo       |
  | `--fs-xl`    | 1.9   | subtítulos              |
  | `--fs-2xl`   | 2.6   | títulos de secção       |
  | `--fs-3xl`   | 3.5   | hero                    |

- **Sistema de cores (tokens):** define tudo em CSS custom properties (ver §5).
  Uma cor de marca + neutros + 1 cor de acento para CTAs. Contraste WCAG AA.
- **Grelha responsiva:** container máximo ~1200px, gutters de 24px, mobile-first.
- **Consistência:** raios de canto, sombras e espaçamentos vêm todos de tokens.
  Nunca valores "à mão".

---

## 2. Estrutura de página padrão (landing)

Ordem recomendada de secções (adapta ao nicho do cliente):

1. **Navbar** — logo + 3–5 links + CTA. Sticky, encolhe no scroll.
2. **Hero** — headline com a proposta de valor + subheadline + CTA primário +
   visual/mockup. Acima da dobra, sem distrações.
3. **Prova social** — faixa de logos ou métrica de confiança ("+200 clientes").
4. **Benefícios** — 3 blocos "o que ganhas" (foco no cliente, não em features).
5. **Features / como funciona** — passos ou cartões com detalhe.
6. **Testemunhos** — citações com nome, foto e cargo. Autenticidade > quantidade.
7. **Pricing** (se aplicável) — 3 planos, um destacado como recomendado.
8. **FAQ** — 4–8 perguntas em acordeão.
9. **CTA final** — repetir a ação principal com uma frase de fecho.
10. **Footer** — navegação secundária, contactos, legal, redes.

---

## 3. Interação e movimento

- **Micro-interações:** feedback em hover/focus/active em tudo o que é clicável.
- **Scroll reveal:** fade/slide suave das secções ao entrar no viewport
  (`IntersectionObserver`), não bibliotecas pesadas.
- **Transições:** 150–300ms, `ease-out`. Nada mais lento.
- **Acessibilidade do movimento:** respeita sempre
  `@media (prefers-reduced-motion: reduce)` — desliga animações não essenciais.

---

## 4. Estrutura de ficheiros do projeto

```
projeto-cliente/
├── index.html
├── css/
│   ├── reset.css        # normalização
│   ├── tokens.css       # variáveis (cores, tipografia, espaçamento)
│   └── styles.css       # estilos do site
├── js/
│   └── main.js          # navbar, scroll reveal, acordeão, etc.
├── assets/
│   ├── img/             # imagens otimizadas (webp/avif)
│   └── icons/           # SVG inline sempre que possível
└── favicon.svg
```

---

## 5. Base CSS (reset + tokens)

`css/reset.css` (mínimo moderno):

```css
*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body { min-height: 100dvh; line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, svg, video { display: block; max-width: 100%; height: auto; }
input, button, textarea, select { font: inherit; }
h1, h2, h3, h4 { line-height: 1.1; text-wrap: balance; }
p { text-wrap: pretty; }
a { color: inherit; text-decoration: none; }
```

`css/tokens.css`:

```css
:root {
  /* cor */
  --color-bg: #ffffff;
  --color-fg: #0f1115;
  --color-muted: #5b6472;
  --color-brand: #4f46e5;
  --color-accent: #f59e0b;
  --color-surface: #f6f7f9;
  --color-border: #e5e7eb;

  /* tipografia */
  --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fs-base: 1rem;
  --lh-tight: 1.1;

  /* espaçamento (escala de 4px) */
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 1rem;
  --space-4: 1.5rem;  --space-5: 2rem;   --space-6: 3rem;
  --space-8: 5rem;

  /* forma */
  --radius: 12px;
  --shadow: 0 10px 30px -12px rgb(0 0 0 / 0.15);
  --container: 1200px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0b0d10;
    --color-fg: #f3f4f6;
    --color-muted: #9aa4b2;
    --color-surface: #14171c;
    --color-border: #232830;
  }
}
```

---

## 6. Performance (alvo: Lighthouse ≥ 95)

- **Imagens:** formato `webp`/`avif`, dimensões corretas, `loading="lazy"` em
  tudo abaixo da dobra, `width`/`height` explícitos para evitar layout shift.
- **Fontes:** `font-display: swap`; se usar Google Fonts, faz *self-host* ou
  pré-carrega. Preferir `system-ui` quando possível.
- **JS:** vanilla, sem frameworks. Adiar (`defer`) scripts não críticos.
- **CSS crítico:** manter o CSS enxuto; nada de frameworks pesados de UI.
- **Sem bloqueios de render** desnecessários no `<head>`.

---

## 7. SEO

- `<title>` único e `<meta name="description">` por página.
- Open Graph + Twitter Card (`og:title`, `og:description`, `og:image`).
- HTML semântico: `<header> <nav> <main> <section> <article> <footer>`.
- Um único `<h1>` por página; hierarquia de headings correta.
- URLs limpos, `sitemap.xml` e `robots.txt`.
- Dados estruturados JSON-LD quando fizer sentido (organização, produto, FAQ).

---

## 8. Acessibilidade (WCAG AA)

- Contraste de texto ≥ 4.5:1 (≥ 3:1 para texto grande).
- Todas as imagens com `alt` significativo (ou `alt=""` se decorativas).
- Navegação por teclado completa; `:focus-visible` sempre visível.
- Landmarks e `aria-*` onde necessário (acordeão, menu mobile).
- Ordem de leitura lógica; nada dependente só de cor.

---

## 9. Checklist de entrega

Antes de dar o site como pronto ao cliente:

- [ ] Responsivo testado em 360px, 768px, 1024px e 1440px.
- [ ] CTA principal claro e presente no hero e no fim.
- [ ] Todas as ligações funcionam; nenhum `#` morto.
- [ ] Lighthouse ≥ 95 em Performance, SEO e Acessibilidade.
- [ ] Meta tags + Open Graph + favicon presentes.
- [ ] Imagens otimizadas e com `alt`.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Testado em Chrome, Firefox e Safari.
- [ ] Formulários validam e mostram estados de erro/sucesso.
- [ ] Sem erros na consola.
- [ ] Textos revistos (ortografia, tom da marca).

---

## 10. Padrões específicos de referência (@webloved)

> **A preencher com o material que o cliente fornecer.**
>
> Não foi possível aceder diretamente ao perfil TikTok (bloqueio HTTP 403), por
> isso esta secção deve ser preenchida a partir dos prints/descrições que o
> dono da agência partilhar. Objetivo: capturar os *padrões* recorrentes
> (tipo de hero, paleta, ritmo de secções, estilo de animação) e **adaptá-los**
> ao sistema acima — não copiar designs proprietários específicos verbatim.

- Estilo de hero observado: _(preencher)_
- Paleta e tipografia dominantes: _(preencher)_
- Estrutura/ordem de secções recorrente: _(preencher)_
- Tom de copy e CTA: _(preencher)_
- Assinaturas de movimento/animação: _(preencher)_
