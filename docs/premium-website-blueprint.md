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

## 10. Padrões de referência (@weblove e afins)

> Padrões extraídos das gravações partilhadas pelo dono da agência (perfil
> @weblove no TikTok + inspiração de UI/UX). **Objetivo: replicar os
> *princípios* e o nível de acabamento — não copiar verbatim designs
> proprietários de marcas reais** (ex.: Cartier, ECCO). Os designs originais dele
> são gerados com ferramentas de IA (Lovable, Claude) + Spline/3D; aqui
> traduzimos essas assinaturas para a stack da agência (**HTML/CSS/JS puro**).

### 10.1 O que torna estes sites "premium" (a assinatura dele)

1. **Nichos de alto valor:** carros de importação, joalharia/relojoaria de luxo,
   imobiliário. Copy e imagética falam de estatuto, confiança e exclusividade.
2. **Hero imersivo com 3D:** peça central 3D interativa (carro, relógio, joia)
   que reage ao rato/scroll. É o "efeito uau" que justifica o preço.
3. **Storytelling por cenas de scroll (parallax):** a página desenrola-se como
   uma sequência de *cenas* (ele estrutura, p.ex., em ~6 cenas 3D). Cada bloco
   revela um objeto/mensagem à medida que se faz scroll.
4. **Duas famílias de estética:**
   - **Escura / cinematográfica** — fundo quase preto, um único acento metálico
     (dourado/âmbar), muito contraste, iluminação dramática. (ref.: AUTOKLASA)
   - **Clara / galeria** — fundo off-white, muito whitespace, serif elegante,
     objeto a "flutuar" com sombra suave. (ref.: joalharia de luxo)
5. **Tipografia grande e confiante:** display oversized no hero; serif para luxo,
   sans geométrica para tech/produto.
6. **Prova social forte:** bloco de testemunhos com *reviews estilo Google*
   (avatar, nome, estrelas, citação curta).
7. **Fecho consistente:** FAQ em acordeão → secção de contacto com **formulário**
   → footer organizado (mapa do site, redes sociais, legal, © ano).

### 10.2 Estrutura de página aplicada (mapeada às secções §2)

```
Navbar (sticky, translúcida)  → logo + O firme/Oferta/Blog/Opinie/Kontakt + CTA
Hero 3D imersivo              → headline oversized + subheadline + CTA + objeto 3D
Showcase / cena escura        → destaque de produto com iluminação dramática
Cenas de scroll (parallax)    → 3–6 blocos que revelam objeto+texto ao fazer scroll
Prova social                  → testemunhos estilo Google (avatar, estrelas)
Contacto                      → morada + contactos + formulário funcional
FAQ                           → acordeão (4–8 perguntas)
Footer                        → mapa do site + redes + legal + © ano
```

### 10.3 Como fazer o 3D/parallax em HTML/CSS/JS puro (sem Lovable)

- **Objeto 3D no hero:** duas opções.
  - *Simples/rápido:* embeber uma cena **Spline** via `<iframe>` ou o
    `<spline-viewer>` web component (script `@splinetool/viewer`). Definir
    `loading="lazy"` e um `poster`/fallback estático para performance.
  - *Controlo total/leve:* **Three.js** com um modelo `.glb` (usar
    `GLTFLoader` + `OrbitControls` desativados, rotação ligada ao scroll/rato).
    Servir o `.glb` comprimido (Draco) e só inicializar quando o hero entra no
    viewport.
- **Cenas de scroll / parallax:** preferir **scroll-driven animations** nativas
  do CSS (`animation-timeline: view()` / `scroll()`), com fallback por
  `IntersectionObserver` que adiciona `.is-visible` a cada `.scene`. Movimento
  de camadas com `transform: translate3d()` (nunca `top/left`), a diferentes
  velocidades por camada.
- **Sempre** respeitar `@media (prefers-reduced-motion: reduce)`: desligar
  parallax e auto-rotação, mostrar a imagem/poster estático.
- **Performance:** o 3D é pesado — lazy-init, `poster` estático até interação,
  e manter o alvo Lighthouse (§6). Se o `.glb` for grande, degradar para
  imagem/vídeo curto em mobile.

### 10.4 Blocos reutilizáveis a ter no kit

- **Hero 3D** (com poster fallback e CTA duplo: primário + "ver oferta").
- **Card de testemunho estilo Google** (avatar, nome, 5 estrelas, data, citação).
- **Acordeão de FAQ** acessível (`<details>/<summary>` ou `button`+`aria-expanded`).
- **Formulário de contacto** com validação e estados de sucesso/erro.
- **Bento-grid** para portefólio/serviços (ref. inspiração "DESIGNTHINKING®":
  cartões de tamanhos variados, 1 destaque grande + apoios).
- **Hero de produto flutuante** (produto com sombra suave sobre fundo/gradiente
  arejado — ref. inspiração ECCO: "Stay in control").

### 10.5 Aviso de propriedade intelectual

Estes exemplos usam marcas reais apenas como **referência de estilo**. Para
clientes, criar identidade, copy, imagética e modelos 3D **originais** (ou
devidamente licenciados). Não reproduzir logótipos, fotografias ou textos de
marcas de terceiros.
