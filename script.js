/* Classic Cover Maker */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const cover = $("cover");
  const art = $("art");

  const DESIGN_W = 540;   // ancho de diseño de la portada (1 unidad --u = 1px a este ancho)
  const EXPORT_W = 2400;  // ancho en píxeles de la imagen exportada
  const TITLE = { min: 14, max: 60, step: 2, initial: 26 };
  let titleSize = TITLE.initial;

  // Logos y limón: se vuelven a dibujar desde el archivo original al exportar.
  const LOGO_SRC = {
    penguin: "resources/penguin.png",
    ao3: "resources/ao3.png",
    fanfiction: "resources/fanfiction.jpeg",
    wattpad: "resources/wattpad.png",
  };
  const LEMON_SRC = "resources/lemon.png";

  // Librerías que solo se cargan si se usa el módulo de ebook.
  const JSZIP_URL = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  const PDFLIB_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";

  /* ---------- 1. Escala: la portada se ve igual en cualquier pantalla ---------- */
  const updateScale = () => {
    cover.style.setProperty("--u", cover.clientWidth / DESIGN_W + "px");
  };
  new ResizeObserver(updateScale).observe(cover);
  updateScale();

  /* ---------- 2. Textos en vivo ---------- */
  const TEXT_FIELDS = [
    ["author", "out-author"],
    ["title", "out-title"],
    ["subtitle", "out-subtitle"],
    ["band-text", "out-band-text"],
  ];
  for (const [inputId, outputId] of TEXT_FIELDS) {
    const input = $(inputId);
    const output = $(outputId);
    const sync = () => { output.textContent = input.value; };
    input.addEventListener("input", sync);
    // Algunos navegadores restauran lo escrito al recargar: empezamos siempre en blanco.
    input.value = "";
    sync();
  }

  // Botón × de cada campo
  for (const btn of document.querySelectorAll("[data-clear]")) {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // evita que el <label> mande el clic al input
      const input = $(btn.dataset.clear);
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
  }

  /* ---------- 3. Tamaño del título (A− / A+) ---------- */
  const applyTitleSize = () => {
    cover.style.setProperty("--title-size", titleSize);
    $("size-value").textContent = titleSize;
    $("size-down").disabled = titleSize <= TITLE.min;
    $("size-up").disabled = titleSize >= TITLE.max;
  };
  $("size-down").addEventListener("click", () => {
    titleSize = Math.max(TITLE.min, titleSize - TITLE.step);
    applyTitleSize();
  });
  $("size-up").addEventListener("click", () => {
    titleSize = Math.min(TITLE.max, titleSize + TITLE.step);
    applyTitleSize();
  });
  applyTitleSize();

  /* ---------- 4. Opciones: Ω, limón y logo (el CSS reacciona a data-*) ---------- */
  const bindOption = (id, attr, read) => {
    const el = $(id);
    const sync = () => { cover.dataset[attr] = read(el); };
    el.addEventListener("change", sync);
    sync();
  };
  bindOption("omega", "omega", (el) => el.checked);
  bindOption("lemon", "lemon", (el) => el.checked);
  bindOption("logo-select", "logo", (el) => el.value);

  /* ---------- 5. Cargar imagen ---------- */
  const FILE_HINT = $("file-name").textContent;

  // Se reduce a un máximo de 3000px para que no pese de más (útil en celulares).
  const readImage = (file, maxSide = 3000) =>
    new Promise((resolve, reject) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * k);
        canvas.height = Math.round(img.naturalHeight * k);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(src);
        resolve(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.92));
      };
      img.onerror = () => {
        URL.revokeObjectURL(src);
        reject(new Error("No se pudo leer la imagen"));
      };
      img.src = src;
    });

  const clearImage = () => {
    art.style.backgroundImage = "";
    $("file-name").textContent = FILE_HINT;
    $("clear-image").hidden = true;
  };

  $("image-file").addEventListener("change", async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const dataUrl = await readImage(file);
      art.style.backgroundImage = `url("${dataUrl}")`;
      $("file-name").textContent = file.name;
      $("clear-image").hidden = false;
    } catch (err) {
      console.error(err);
      alert("No se pudo abrir esa imagen. Prueba con un JPG o PNG.");
    }
    input.value = ""; // permite volver a elegir el mismo archivo
  });
  $("clear-image").addEventListener("click", clearImage);

  /* ---------- 6. Nueva portada: borra todos los datos rellenables ---------- */
  $("clear-all").addEventListener("click", () => {
    const hasData =
      TEXT_FIELDS.some(([id]) => $(id).value.trim() !== "") ||
      art.style.backgroundImage !== "" ||
      titleSize !== TITLE.initial;
    if (hasData && !confirm("¿Borrar todos los datos y empezar una portada nueva?")) return;

    for (const [id] of TEXT_FIELDS) {
      $(id).value = "";
      $(id).dispatchEvent(new Event("input", { bubbles: true }));
    }
    clearImage();
    titleSize = TITLE.initial;
    applyTitleSize();
    $("author").focus();
  });

  /* ---------- 7. Render de la portada en alta resolución ---------- */
  const imageCache = new Map();
  const loadImage = (src) => {
    if (!imageCache.has(src)) {
      imageCache.set(src, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar " + src));
        img.src = src;
      }));
    }
    return imageCache.get(src);
  };

  // Reduce la imagen a la mitad varias veces antes del tamaño final:
  // así no se ve pixelada ni en Safari (que ignora imageSmoothingQuality).
  const resample = (img, w, h) => {
    let source = img;
    let sw = img.naturalWidth || img.width;
    let sh = img.naturalHeight || img.height;
    while (sw / 2 >= w && sh / 2 >= h) {
      const step = document.createElement("canvas");
      step.width = Math.round(sw / 2);
      step.height = Math.round(sh / 2);
      const sctx = step.getContext("2d");
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(source, 0, 0, step.width, step.height);
      source = step;
      sw = step.width;
      sh = step.height;
    }
    return source;
  };

  // Dibuja la imagen como "background-size: contain" dentro de la caja de `el`.
  const drawContained = async (ctx, el, src, scale) => {
    const style = getComputedStyle(el);
    if (style.display === "none") return;
    const img = await loadImage(src);
    const c = cover.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const boxW = r.width * scale;
    const boxH = r.height * scale;
    const k = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    const x = (r.left - c.left) * scale + (boxW - w) / 2;
    const y = (r.top - c.top) * scale + (boxH - h) / 2;

    ctx.save();
    ctx.globalAlpha = parseFloat(style.opacity) || 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(resample(img, Math.ceil(w), Math.ceil(h)), x, y, w, h);
    ctx.restore();
  };

  const renderCover = async () => {
    if (typeof html2canvas !== "function") {
      throw new Error("No se pudo cargar html2canvas. Revisa tu conexión e intenta de nuevo.");
    }
    await document.fonts.ready;
    cover.classList.add("exporting"); // quita esquinas redondeadas y sombra
    try {
      const scale = EXPORT_W / cover.offsetWidth;
      const canvas = await html2canvas(cover, {
        scale,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        // html2canvas escala mal las imágenes de fondo: las ocultamos en la copia
        // y las dibujamos después desde el archivo original.
        onclone: (doc) => {
          for (const el of doc.querySelectorAll("#cover .logo, #cover .lemon")) {
            el.style.visibility = "hidden";
          }
        },
      });

      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0); // html2canvas deja aplicada su propia escala
      const k = canvas.width / cover.offsetWidth;
      await drawContained(ctx, cover.querySelector(".logo"), LOGO_SRC[cover.dataset.logo] || LOGO_SRC.penguin, k);
      await drawContained(ctx, cover.querySelector(".lemon"), LEMON_SRC, k);
      return canvas;
    } finally {
      cover.classList.remove("exporting");
    }
  };

  const canvasToBlob = (canvas, type, quality) =>
    new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se generó el archivo"))), type, quality));

  /* ---------- 8. Descargas ---------- */
  const slugify = (s) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const saveBlob = (blob, filename) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  };

  const downloadBtn = $("download");
  downloadBtn.addEventListener("click", async () => {
    const label = downloadBtn.textContent;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Generando…";
    try {
      const canvas = await renderCover();
      const blob = await canvasToBlob(canvas, "image/png");
      saveBlob(blob, `${slugify($("title").value) || "portada"}-cover.png`);
    } catch (err) {
      console.error(err);
      alert(err.message.startsWith("No se pudo cargar html2canvas")
        ? err.message
        : "No se pudo generar la imagen. Abre el sitio con Live Server (http://) y no haciendo doble clic en el archivo.");
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = label;
    }
  });

  /* =====================================================================
     9. Portada para ebook: EPUB / KEPUB, FB2, CBZ y PDF.
        Todo ocurre en el navegador; el archivo nunca sale del dispositivo.
     ===================================================================== */
  const scriptCache = new Map();
  const loadScript = (src) => {
    if (!scriptCache.has(src)) {
      scriptCache.set(src, new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => {
          scriptCache.delete(src);
          reject(new Error("No se pudo cargar una librería. Revisa tu conexión e intenta de nuevo."));
        };
        document.head.appendChild(s);
      }));
    }
    return scriptCache.get(src);
  };

  class UserError extends Error {}

  const parseXML = (text, type = "application/xml") => {
    const doc = new DOMParser().parseFromString(text, type);
    if (doc.getElementsByTagName("parsererror").length) return null;
    return doc;
  };
  const serializeXML = (doc) =>
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/, "");

  const byLocalName = (root, name) =>
    [...root.getElementsByTagName("*")].filter((el) => el.localName === name);

  // Resuelve una ruta relativa dentro del zip ("OEBPS/" + "../Images/a.jpg").
  const resolvePath = (baseDir, href) => {
    const clean = href.split("#")[0];
    const url = new URL(clean, "https://x/" + baseDir);
    return decodeURIComponent(url.pathname.slice(1));
  };
  const dirOf = (path) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "");
  const baseName = (path) => path.slice(path.lastIndexOf("/") + 1);

  const zipFile = (zip, path) =>
    zip.file(path) || zip.file(new RegExp("^" + path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"))[0] || null;

  // Copia el zip poniendo "mimetype" primero y sin comprimir (requisito de EPUB).
  const rebuildZip = async (zip, { epub = false } = {}) => {
    const out = new JSZip();
    if (epub) out.file("mimetype", "application/epub+zip", { compression: "STORE" });
    const entries = [];
    zip.forEach((path, entry) => {
      if (entry.dir || (epub && path === "mimetype")) return;
      entries.push([path, entry]);
    });
    for (const [path, entry] of entries) {
      out.file(path, await entry.async("uint8array"), { date: entry.date, createFolders: false });
    }
    return out.generateAsync({
      type: "blob",
      mimeType: epub ? "application/epub+zip" : "application/vnd.comicbook+zip",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  };

  /* ----- EPUB ----- */
  // Algoritmos de "encryption.xml" que solo ofuscan fuentes (no son DRM).
  const FONT_OBFUSCATION = [
    "http://www.idpf.org/2008/embedding",
    "http://ns.adobe.com/pdf/enc#RC",
  ];

  // Ajusta las páginas de portada que envuelven la imagen en un <svg> con
  // el tamaño viejo, para que la nueva no se vea deformada.
  const fixCoverWrappers = async (zip, opfDir, items, coverPath, w, h) => {
    const name = baseName(coverPath);
    for (const item of items) {
      const type = item.getAttribute("media-type") || "";
      if (!/xhtml|html/.test(type)) continue;
      const path = resolvePath(opfDir, item.getAttribute("href") || "");
      const file = zipFile(zip, path);
      if (!file) continue;
      const text = await file.async("string");
      if (!text.includes(name) && !text.includes(encodeURIComponent(name))) continue;
      const doc = parseXML(text, "application/xhtml+xml");
      if (!doc) continue;

      let changed = false;
      for (const img of byLocalName(doc, "image")) {
        const href = img.getAttribute("xlink:href") || img.getAttribute("href") ||
          img.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
        if (resolvePath(dirOf(path), href) !== coverPath) continue;
        if (img.hasAttribute("width")) img.setAttribute("width", w);
        if (img.hasAttribute("height")) img.setAttribute("height", h);
        let svg = img.parentNode;
        while (svg && svg.localName !== "svg") svg = svg.parentNode;
        if (svg && svg.setAttribute) {
          svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
          changed = true;
        }
      }
      if (changed) zip.file(path, serializeXML(doc));
    }
  };

  const epubSetCover = async (buffer, art) => {
    await loadScript(JSZIP_URL);
    let zip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw new UserError("Ese archivo no parece un EPUB válido.");
    }

    const encryption = zipFile(zip, "META-INF/encryption.xml");
    if (encryption) {
      const doc = parseXML(await encryption.async("string"));
      const algorithms = doc ? byLocalName(doc, "EncryptionMethod").map((m) => m.getAttribute("Algorithm")) : [];
      if (algorithms.some((a) => !FONT_OBFUSCATION.includes(a))) {
        throw new UserError("Este EPUB tiene DRM (está cifrado). No se puede modificar.");
      }
    }

    const containerFile = zipFile(zip, "META-INF/container.xml");
    const container = containerFile && parseXML(await containerFile.async("string"));
    const rootfile = container && byLocalName(container, "rootfile")[0];
    const opfPath = rootfile && rootfile.getAttribute("full-path");
    const opfFile = opfPath && zipFile(zip, opfPath);
    const opf = opfFile && parseXML(await opfFile.async("string"));
    if (!opf) throw new UserError("No se encontró el índice del EPUB (archivo .opf).");

    const pkg = opf.documentElement;
    const NS = pkg.namespaceURI;
    const isV3 = parseFloat(pkg.getAttribute("version") || "2") >= 3;
    const opfDir = dirOf(opfFile.name);
    const manifest = byLocalName(opf, "manifest")[0];
    const metadata = byLocalName(opf, "metadata")[0];
    const spine = byLocalName(opf, "spine")[0];
    if (!manifest || !metadata || !spine) throw new UserError("El EPUB está incompleto (falta manifest, metadata o spine).");

    const items = byLocalName(manifest, "item");
    const isImage = (item) => /^image\/(jpeg|png|gif|webp)$/.test(item.getAttribute("media-type") || "");
    const metaCover = byLocalName(metadata, "meta").find((m) => m.getAttribute("name") === "cover");

    // 1) EPUB 3: properties="cover-image"; 2) EPUB 2: <meta name="cover">; 3) una imagen llamada "cover".
    let coverItem =
      items.find((i) => (i.getAttribute("properties") || "").split(/\s+/).includes("cover-image")) ||
      (metaCover && items.find((i) => i.getAttribute("id") === metaCover.getAttribute("content"))) ||
      items.find((i) => isImage(i) && /cover|portada/i.test((i.getAttribute("id") || "") + (i.getAttribute("href") || "")));
    if (coverItem && !isImage(coverItem)) coverItem = null;

    let changedOpf = false;
    if (coverItem) {
      // Sustituye la imagen en la misma ruta para que todo lo que la usa siga funcionando.
      const coverPath = resolvePath(opfDir, coverItem.getAttribute("href"));
      const asPng = coverItem.getAttribute("media-type") === "image/png";
      zip.file(coverPath, asPng ? art.png : art.jpeg);
      if (!asPng && coverItem.getAttribute("media-type") !== "image/jpeg") {
        coverItem.setAttribute("media-type", "image/jpeg");
        changedOpf = true;
      }
      await fixCoverWrappers(zip, opfDir, items, coverPath, art.width, art.height);
    } else {
      // No tenía portada: se agrega la imagen, una página de portada al inicio y los metadatos.
      const ids = new Set(items.map((i) => i.getAttribute("id")));
      const uniqueId = (base) => { let id = base, n = 1; while (ids.has(id)) id = base + "-" + n++; ids.add(id); return id; };
      const uniquePath = (base, ext) => { let p = base + ext, n = 1; while (zip.file(opfDir + p)) p = `${base}-${n++}${ext}`; return p; };

      const imgHref = uniquePath("cover-image", ".jpg");
      const pageHref = uniquePath("cover-page", ".xhtml");
      const imgId = uniqueId("cover-image");
      const pageId = uniqueId("cover-page");
      zip.file(opfDir + imgHref, art.jpeg);
      zip.file(opfDir + pageHref,
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">\n' +
        "<head><title>Cover</title>" +
        '<style type="text/css">html,body{margin:0;padding:0;height:100%;text-align:center}svg{display:block;width:100%;height:100%}</style></head>\n' +
        '<body epub:type="cover"><div>\n' +
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 ${art.width} ${art.height}" preserveAspectRatio="xMidYMid meet">` +
        `<image width="${art.width}" height="${art.height}" xlink:href="${imgHref}"/></svg>\n` +
        "</div></body>\n</html>\n");

      const imgItem = opf.createElementNS(NS, "item");
      imgItem.setAttribute("id", imgId);
      imgItem.setAttribute("href", imgHref);
      imgItem.setAttribute("media-type", "image/jpeg");
      if (isV3) imgItem.setAttribute("properties", "cover-image");
      manifest.appendChild(imgItem);

      const pageItem = opf.createElementNS(NS, "item");
      pageItem.setAttribute("id", pageId);
      pageItem.setAttribute("href", pageHref);
      pageItem.setAttribute("media-type", "application/xhtml+xml");
      if (isV3) pageItem.setAttribute("properties", "svg");
      manifest.appendChild(pageItem);

      const itemref = opf.createElementNS(NS, "itemref");
      itemref.setAttribute("idref", pageId);
      spine.insertBefore(itemref, byLocalName(spine, "itemref")[0] || null);

      if (metaCover) {
        metaCover.setAttribute("content", imgId);
      } else {
        const meta = opf.createElementNS(NS, "meta");
        meta.setAttribute("name", "cover");
        meta.setAttribute("content", imgId);
        metadata.appendChild(meta);
      }

      let guide = byLocalName(opf, "guide")[0];
      if (!guide && !isV3) {
        guide = opf.createElementNS(NS, "guide");
        pkg.appendChild(guide);
      }
      if (guide) {
        for (const ref of byLocalName(guide, "reference")) {
          if (ref.getAttribute("type") === "cover") ref.remove();
        }
        const ref = opf.createElementNS(NS, "reference");
        ref.setAttribute("type", "cover");
        ref.setAttribute("title", "Cover");
        ref.setAttribute("href", pageHref);
        guide.insertBefore(ref, guide.firstChild);
      }
      changedOpf = true;
    }

    if (changedOpf) zip.file(opfFile.name, serializeXML(opf));
    return rebuildZip(zip, { epub: true });
  };

  /* ----- FB2 ----- */
  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const fb2SetCover = async (buffer, art) => {
    const bytes = new Uint8Array(buffer);
    const head = new TextDecoder("latin1").decode(bytes.slice(0, 300));
    const encoding = (/encoding=["']([^"']+)["']/i.exec(head) || [])[1] || "utf-8";
    let text;
    try {
      text = new TextDecoder(encoding).decode(bytes);
    } catch {
      text = new TextDecoder("utf-8").decode(bytes);
    }
    const doc = parseXML(text);
    const root = doc && doc.documentElement;
    if (!root || root.localName !== "FictionBook") throw new UserError("Ese archivo no parece un FB2 válido.");

    const NS = root.namespaceURI;
    const XLINK = "http://www.w3.org/1999/xlink";
    const titleInfo = byLocalName(root, "title-info")[0];
    if (!titleInfo) throw new UserError("El FB2 no tiene sección <title-info>.");

    let prefix = root.lookupPrefix(XLINK);
    if (!prefix) {
      prefix = "l";
      root.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:l", XLINK);
    }

    const binaries = byLocalName(root, "binary");
    let coverpage = byLocalName(titleInfo, "coverpage")[0];
    let id = "";
    if (coverpage) {
      const img = byLocalName(coverpage, "image")[0];
      const href = img && (img.getAttributeNS(XLINK, "href") || img.getAttribute(prefix + ":href") || "");
      id = (href || "").replace(/^#/, "");
      // Deja solo una imagen en la portada
      for (const extra of byLocalName(coverpage, "image").slice(1)) extra.remove();
      if (!img) coverpage = null;
    }
    if (!coverpage) {
      coverpage = byLocalName(titleInfo, "coverpage")[0] || doc.createElementNS(NS, "coverpage");
      while (coverpage.firstChild) coverpage.firstChild.remove();
      const before = ["lang", "src-lang", "translator", "sequence"]
        .map((n) => byLocalName(titleInfo, n)[0]).find(Boolean) || null;
      if (!coverpage.parentNode) titleInfo.insertBefore(coverpage, before);
    }
    const ids = new Set(binaries.map((b) => b.getAttribute("id")));
    if (!id) {
      id = "cover.jpg";
      for (let n = 1; ids.has(id); n++) id = `cover-${n}.jpg`;
    }
    let img = byLocalName(coverpage, "image")[0];
    if (!img) {
      img = doc.createElementNS(NS, "image");
      coverpage.appendChild(img);
    }
    img.setAttributeNS(XLINK, prefix + ":href", "#" + id);

    let binary = binaries.find((b) => b.getAttribute("id") === id);
    if (!binary) {
      binary = doc.createElementNS(NS, "binary");
      binary.setAttribute("id", id);
      root.appendChild(binary);
    }
    binary.setAttribute("content-type", "image/jpeg");
    binary.textContent = await blobToBase64(art.jpeg);

    return new Blob([serializeXML(doc)], { type: "application/x-fictionbook+xml" });
  };

  /* ----- CBZ (cómic) ----- */
  const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;

  const cbzSetCover = async (buffer, art, replace) => {
    await loadScript(JSZIP_URL);
    let zip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw new UserError("Ese archivo no parece un CBZ válido.");
    }
    const pages = [];
    zip.forEach((path, entry) => {
      if (!entry.dir && IMAGE_RE.test(path) && !path.startsWith("__MACOSX/") && !baseName(path).startsWith(".")) {
        pages.push(path);
      }
    });
    if (!pages.length) throw new UserError("El CBZ no tiene imágenes.");
    pages.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    const first = pages[0];

    if (replace) {
      zip.remove(first);
      zip.file(first.replace(/\.[^.]+$/, ".jpg"), art.jpeg);
    } else {
      // "!" va antes que números y letras: los lectores la muestran como primera página.
      zip.file(dirOf(first) + "!cover.jpg", art.jpeg);
    }
    return rebuildZip(zip);
  };

  /* ----- PDF ----- */
  const pdfSetCover = async (buffer, art, replace) => {
    await loadScript(PDFLIB_URL);
    const { PDFDocument } = window.PDFLib;
    let pdf;
    try {
      pdf = await PDFDocument.load(buffer);
    } catch (err) {
      if (/encrypt/i.test(String(err && err.message))) {
        throw new UserError("Este PDF está protegido con contraseña. No se puede modificar.");
      }
      throw new UserError("Ese archivo no parece un PDF válido.");
    }
    const jpg = await pdf.embedJpg(new Uint8Array(await art.jpeg.arrayBuffer()));
    const count = pdf.getPageCount();
    const ref = count ? pdf.getPage(0).getSize() : { width: 595.28, height: 841.89 };
    const width = ref.width;
    const height = width * (art.height / art.width);

    if (replace && count) pdf.removePage(0);
    const page = pdf.insertPage(0, [width, height]);
    page.drawImage(jpg, { x: 0, y: 0, width, height });

    const bytes = await pdf.save();
    return new Blob([bytes], { type: "application/pdf" });
  };

  /* ----- UI del módulo ----- */
  const FORMATS = {
    epub: { label: "EPUB", run: epubSetCover },
    kepub: { label: "KEPUB", run: epubSetCover },
    fb2: { label: "FB2", run: fb2SetCover },
    cbz: { label: "CBZ", run: cbzSetCover, canReplace: true },
    pdf: { label: "PDF", run: pdfSetCover, canReplace: true },
  };
  const UNSUPPORTED = /\.(mobi|azw3?|kfx|prc|cbr|cb7|djvu|lit)$/i;

  const ebookInput = $("ebook-file");
  const ebookName = $("ebook-name");
  const ebookApply = $("ebook-apply");
  const ebookStatus = $("ebook-status");
  const replaceRow = $("ebook-replace-row");
  const EBOOK_HINT = ebookName.textContent;
  let ebookFile = null;
  let ebookFormat = null;

  const setStatus = (msg, kind = "") => {
    ebookStatus.textContent = msg;
    ebookStatus.className = "status" + (kind ? " " + kind : "");
  };

  const formatOf = (name) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".kepub.epub") || lower.endsWith(".kepub")) return "kepub";
    const ext = lower.slice(lower.lastIndexOf(".") + 1);
    return FORMATS[ext] ? ext : null;
  };

  ebookInput.addEventListener("change", () => {
    const file = ebookInput.files && ebookInput.files[0];
    ebookInput.value = "";
    if (!file) return;

    ebookFile = null;
    ebookFormat = null;
    ebookApply.disabled = true;
    replaceRow.hidden = true;

    if (UNSUPPORTED.test(file.name)) {
      ebookName.textContent = EBOOK_HINT;
      setStatus("Ese formato (MOBI/AZW/KFX/CBR) no se puede editar aquí. Conviértelo a EPUB con Calibre y vuelve a intentarlo.", "error");
      return;
    }
    const format = formatOf(file.name);
    if (!format) {
      ebookName.textContent = EBOOK_HINT;
      setStatus("Formato no reconocido. Usa EPUB, KEPUB, FB2, CBZ o PDF.", "error");
      return;
    }

    ebookFile = file;
    ebookFormat = format;
    ebookName.textContent = file.name;
    replaceRow.hidden = !FORMATS[format].canReplace;
    ebookApply.disabled = false;
    setStatus(`${FORMATS[format].label} listo. Se usará la portada que tienes en pantalla.`);
  });

  ebookApply.addEventListener("click", async () => {
    if (!ebookFile || !ebookFormat) return;
    const label = ebookApply.textContent;
    ebookApply.disabled = true;
    ebookApply.textContent = "Procesando…";
    setStatus("Generando la portada…");

    try {
      const canvas = await renderCover();
      const art = {
        width: canvas.width,
        height: canvas.height,
        jpeg: await canvasToBlob(canvas, "image/jpeg", 0.92),
        // PNG solo para EPUBs cuya portada original ya era PNG
        png: await canvasToBlob(canvas, "image/png"),
      };

      setStatus(`Aplicando la portada al ${FORMATS[ebookFormat].label}…`);
      const buffer = await ebookFile.arrayBuffer();
      const blob = await FORMATS[ebookFormat].run(buffer, art, $("ebook-replace").checked);

      saveBlob(blob, ebookFile.name.replace(/(\.kepub)?(\.[^.]+)$/i, "-cover$1$2"));
      setStatus("¡Listo! Se descargó el libro con la nueva portada.", "ok");
    } catch (err) {
      console.error(err);
      setStatus(err instanceof UserError || /librería/.test(err.message)
        ? err.message
        : "No se pudo aplicar la portada a este archivo.", "error");
    } finally {
      ebookApply.disabled = false;
      ebookApply.textContent = label;
    }
  });
})();
