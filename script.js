/* Classic Cover Maker */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const cover = $("cover");
  const art = $("art");

  const DESIGN_W = 540;   // ancho de diseño de la portada (1 unidad --u = 1px a este ancho)
  const EXPORT_W = 1600;  // ancho en píxeles del PNG descargado
  const TITLE = { min: 14, max: 60, step: 2 };
  let titleSize = 26;

  /* ---------- 1. Escala: la portada se ve igual en cualquier pantalla ---------- */
  const updateScale = () => {
    cover.style.setProperty("--u", cover.clientWidth / DESIGN_W + "px");
  };
  new ResizeObserver(updateScale).observe(cover);
  updateScale();

  /* ---------- 2. Textos en vivo ---------- */
  const bindText = (inputId, outputId) => {
    const input = $(inputId);
    const output = $(outputId);
    const sync = () => { output.textContent = input.value; };
    input.addEventListener("input", sync);
    sync();
  };
  bindText("author", "out-author");
  bindText("title", "out-title");
  bindText("subtitle", "out-subtitle");
  bindText("band-text", "out-band-text");

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
  // Se reduce a un máximo de 2400px para que no pese de más (útil en celulares).
  const readImage = (file, maxSide = 2400) =>
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

  $("image-file").addEventListener("change", async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const dataUrl = await readImage(file);
      art.style.backgroundImage = `url("${dataUrl}")`;
      $("file-name").textContent = file.name;
    } catch (err) {
      console.error(err);
      alert("No se pudo abrir esa imagen. Prueba con un JPG o PNG.");
    }
    input.value = ""; // permite volver a elegir el mismo archivo
  });

  /* ---------- 6. Descargar portada como PNG ---------- */
  const slugify = (s) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const downloadBtn = $("download");
  downloadBtn.addEventListener("click", async () => {
    if (typeof html2canvas !== "function") {
      alert("No se pudo cargar html2canvas. Revisa tu conexión e intenta de nuevo.");
      return;
    }

    const label = downloadBtn.textContent;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "Generando…";
    cover.classList.add("exporting"); // quita esquinas redondeadas y sombra

    try {
      await document.fonts.ready;

      const canvas = await html2canvas(cover, {
        scale: EXPORT_W / cover.offsetWidth,
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se generó el archivo");

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${slugify($("title").value) || "portada"}-cover.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar la imagen. Abre el sitio con Live Server (http://) y no haciendo doble clic en el archivo.");
    } finally {
      cover.classList.remove("exporting");
      downloadBtn.disabled = false;
      downloadBtn.textContent = label;
    }
  });
})();